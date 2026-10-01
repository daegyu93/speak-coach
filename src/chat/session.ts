import { AiError } from '../ai/errors';
import type { ChatModel } from '../ai/model';
import { buildReviewPrompt, formatTranscript } from '../ai/prompt';
import type { Correction, Mode, SessionReview, Turn, TurnResult } from '../types';

export interface ChatTurn extends Turn {
  feedback?: Correction;
  failed?: boolean;
}

export type SessionStatus = 'idle' | 'waiting' | 'ready' | 'finishing' | 'done';

export interface SessionState {
  turns: ChatTurn[];
  status: SessionStatus;
  error: AiError | null;
}

export interface SessionDeps {
  model: ChatModel;
  speak(text: string): void;
  saveMistakes(corrections: Correction[]): Promise<void>;
  saveSession(turns: Turn[]): Promise<void>;
}

const toAiError = (e: unknown): AiError => (e instanceof AiError ? e : new AiError('bad_response', String(e)));

export class ChatSession {
  private state: SessionState = { turns: [], status: 'idle', error: null };

  constructor(
    private readonly mode: Mode,
    private readonly system: string,
    private readonly deps: SessionDeps,
    private readonly onChange: (s: SessionState) => void,
  ) {}

  getState(): SessionState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state.status !== 'idle') return;
    this.update({ status: 'waiting', error: null });
    let res: TurnResult;
    try {
      res = await this.deps.model.turn(this.system, [], false);
    } catch (e) {
      this.update({ status: 'idle', error: toAiError(e) });
      return;
    }
    this.update({ turns: [{ role: 'ai', text: res.reply }], status: 'ready' });
    this.deps.speak(res.reply);
  }

  async send(text: string): Promise<boolean> {
    const t = text.trim();
    if (!t || this.state.status !== 'ready' || this.state.turns.at(-1)?.failed) return false;
    this.update({ turns: [...this.state.turns, { role: 'user', text: t }] });
    await this.request();
    return true;
  }

  async retry(): Promise<void> {
    if (!this.state.error) return;
    if (this.state.status === 'idle') return this.start();
    const last = this.state.turns.at(-1);
    if (this.state.status === 'ready' && last?.failed) {
      this.update({ turns: [...this.state.turns.slice(0, -1), { role: 'user', text: last.text }] });
      await this.request();
    }
  }

  async finish(): Promise<SessionReview | null> {
    if (this.state.status !== 'ready') return null;
    const history = this.history();
    if (!history.some((t) => t.role === 'user')) {
      this.update({ status: 'done' });
      return { corrections: [], phrases: [], summary_ko: '대화한 내용이 없어요.' };
    }
    this.update({ status: 'finishing', error: null });
    let review: SessionReview;
    try {
      review = await this.deps.model.review(buildReviewPrompt(), formatTranscript(history));
    } catch (e) {
      this.update({ status: 'ready', error: toAiError(e) });
      return null;
    }
    this.update({ status: 'done' });
    if (this.mode === 'after') await this.deps.saveMistakes(review.corrections);
    await this.deps.saveSession(history);
    return review;
  }

  private async request(): Promise<void> {
    this.update({ status: 'waiting', error: null });
    const withFeedback = this.mode === 'each';
    let res: TurnResult;
    try {
      res = await this.deps.model.turn(this.system, this.history(), withFeedback);
    } catch (e) {
      const turns = [...this.state.turns];
      turns[turns.length - 1] = { ...turns[turns.length - 1], failed: true };
      this.update({ turns, status: 'ready', error: toAiError(e) });
      return;
    }
    const turns = [...this.state.turns];
    if (withFeedback && res.feedback) turns[turns.length - 1] = { ...turns[turns.length - 1], feedback: res.feedback };
    this.update({ turns: [...turns, { role: 'ai', text: res.reply }], status: 'ready' });
    if (withFeedback && res.feedback) await this.deps.saveMistakes([res.feedback]);
    this.deps.speak(res.reply);
  }

  private history(): Turn[] {
    return this.state.turns.filter((t) => !t.failed).map(({ role, text }) => ({ role, text }));
  }

  private update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
}
