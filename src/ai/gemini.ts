import type { SessionReview, Turn, TurnResult } from '../types';
import { AiError, type AiErrorKind } from './errors';
import type { ChatModel } from './model';
import { START_CUE } from './prompt';
import {
  parseJsonText, parseSessionReview, parseTurnResult, replySchema, replyWithFeedbackSchema, reviewSchema,
} from './schema';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = new Set<AiErrorKind>(['rate_limit', 'unavailable', 'bad_response']);

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelayMs?: number;
}

function kindForStatus(status: number, body: string): AiErrorKind {
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'unavailable';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) return 'bad_key';
  return 'bad_response';
}

export class GeminiChatModel implements ChatModel {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retryDelayMs: number;

  constructor(private readonly opts: GeminiOptions) {
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.retryDelayMs = opts.retryDelayMs ?? 1500;
  }

  turn(system: string, history: Turn[], withFeedback: boolean): Promise<TurnResult> {
    const feedback = withFeedback && history.length > 0;
    const contents: Content[] = [
      { role: 'user', parts: [{ text: START_CUE }] },
      ...history.map((t): Content => ({ role: t.role === 'ai' ? 'model' : 'user', parts: [{ text: t.text }] })),
    ];
    return this.generate(system, contents, feedback ? replyWithFeedbackSchema : replySchema, (v) =>
      parseTurnResult(v, feedback),
    );
  }

  review(system: string, transcript: string): Promise<SessionReview> {
    return this.generate(system, [{ role: 'user', parts: [{ text: transcript }] }], reviewSchema, parseSessionReview);
  }

  private async generate<T>(system: string, contents: Content[], schema: object, parse: (v: unknown) => T): Promise<T> {
    if (!this.opts.apiKey.trim()) throw new AiError('no_key');
    let last: AiError | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await this.sleep(this.retryDelayMs);
      try {
        return parse(parseJsonText(await this.call(system, contents, schema)));
      } catch (e) {
        if (e instanceof AiError && RETRYABLE.has(e.kind)) {
          last = e;
          continue;
        }
        throw e;
      }
    }
    throw last!;
  }

  private async call(system: string, contents: Content[], schema: object): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/${encodeURIComponent(this.opts.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.opts.apiKey.trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 },
        }),
      });
    } catch {
      throw new AiError('network');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiError(kindForStatus(res.status, body), `HTTP ${res.status}`);
    }
    const data = (await res.json().catch(() => null)) as
      | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      | null;
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AiError('bad_response', 'empty candidate');
    return text;
  }
}
