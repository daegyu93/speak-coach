import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AI_ERROR_KO } from '../ai/errors';
import { GeminiChatModel } from '../ai/gemini';
import { buildSystemPrompt } from '../ai/prompt';
import { ChatSession, type SessionState } from '../chat/session';
import { SpeechError, type SpeechOutput } from '../speech/types';
import { WebSpeechInput } from '../speech/webSpeech';
import { addMistakes, loadMistakes, saveSession } from '../storage/db';
import { buildFocus, toEntries } from '../storage/mistakes';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { CorrectionCard } from './CorrectionCard';
import { speechMessage } from './labels';

interface Props {
  scenario: Scenario;
  mode: Mode;
  settings: Settings;
  output: SpeechOutput;
  onDone: (review: SessionReview) => void;
  onExit: () => void;
}

export function ChatScreen({ scenario, mode, settings, output, onDone, onExit }: Props) {
  const input = useMemo(() => new WebSpeechInput(), []);
  const sessionRef = useRef<ChatSession | null>(null);
  const recordingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SessionState>({ turns: [], status: 'idle', error: null });
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState(input.supported ? '' : speechMessage(new SpeechError('unsupported')));
  const [text, setText] = useState('');
  const voice = { rate: settings.rate, voiceURI: settings.voiceURI };

  useEffect(() => {
    let alive = true;
    (async () => {
      const focus = buildFocus(await loadMistakes());
      const session = new ChatSession(
        mode,
        buildSystemPrompt(scenario, mode, focus),
        {
          model: new GeminiChatModel({ apiKey: settings.apiKey, model: settings.model }),
          speak: (t) => void output.speak(t, voice),
          saveMistakes: (c) => addMistakes(toEntries(c, scenario.id)),
          saveSession: (turns) => saveSession({ at: Date.now(), scenarioId: scenario.id, mode, turns }),
        },
        (s) => alive && setState(s),
      );
      if (!alive) return;
      sessionRef.current = session;
      await session.start();
    })();
    return () => {
      alive = false;
      sessionRef.current?.dispose();
      output.cancel();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.turns.length, state.status]);

  const send = async (said: string) => {
    if (await sessionRef.current?.send(said)) setText('');
  };

  const micDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    output.cancel();
    setHint('');
    try {
      input.start();
      recordingRef.current = true;
      setRecording(true);
    } catch (err) {
      setHint(speechMessage(err));
    }
  };

  const micUp = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    try {
      const said = await input.stop();
      if (!said) {
        setHint('잘 안 들렸어요. 다시 말해 주세요.');
        return;
      }
      await send(said);
    } catch (err) {
      setHint(speechMessage(err));
    }
  };

  const finish = async () => {
    output.cancel();
    const review = await sessionRef.current?.finish();
    if (review) onDone(review);
  };

  const { turns, status, error } = state;
  const lastFailed = turns.at(-1)?.failed === true;
  const busy = status === 'waiting' || status === 'finishing';
  const canTalk = status === 'ready' && !lastFailed;

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onExit} aria-label="나가기">←</button>
        <h1>{scenario.emoji} {scenario.title_ko}</h1>
        <button class="primary" onClick={finish} disabled={status !== 'ready'}>끝내기</button>
      </header>

      <div class="chat" ref={listRef}>
        {turns.map((t, i) =>
          t.role === 'ai' ? (
            <div key={i} class="bubble ai">
              {t.text}{' '}
              <button onClick={() => output.speak(t.text, voice)} aria-label="다시 듣기">🔊</button>
            </div>
          ) : (
            <div key={i} style={{ display: 'contents' }}>
              <div class="bubble user">{t.text}{t.failed && ' ⚠️'}</div>
              {t.feedback && <CorrectionCard c={t.feedback} />}
            </div>
          ),
        )}
        {status === 'waiting' && <div class="bubble ai">…</div>}
        {status === 'finishing' && <div class="muted">교정 결과를 만드는 중이에요…</div>}
      </div>

      {error && (
        <div class="row">
          <span class="error">{AI_ERROR_KO[error.kind]}</span>
          {(status === 'idle' || lastFailed) && (
            <button onClick={() => sessionRef.current?.retry()}>다시 보내기</button>
          )}
        </div>
      )}
      {hint && <div class="error">{hint}</div>}

      {input.supported && (
        <button
          class={recording ? 'mic on' : 'mic'}
          disabled={!canTalk}
          onPointerDown={micDown}
          onPointerUp={micUp}
          onPointerCancel={micUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {recording ? '🔴 듣는 중… 떼면 전송' : busy ? '…' : '🎤 누르고 말하기'}
        </button>
      )}
      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="또는 여기에 입력" disabled={!canTalk} />
        <button class="primary" disabled={!canTalk || !text.trim()}>보내기</button>
      </form>
    </div>
  );
}
