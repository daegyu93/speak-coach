import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../../src/ai/errors';
import type { ChatModel } from '../../src/ai/model';
import { ChatSession, type SessionState } from '../../src/chat/session';
import type { Correction, Mode, SessionReview, TurnResult } from '../../src/types';

const fb: Correction = { original: 'hear', better: 'For here, please.', point_ko: '철자', category: 'word_choice', ok: true };
const review: SessionReview = { corrections: [fb], phrases: [{ en: 'For here', ko: '매장에서' }], summary_ko: '좋아요' };

function setup(mode: Mode, turns: (TurnResult | Error)[], reviewResult: SessionReview | Error = review) {
  const model: ChatModel = {
    turn: vi.fn(async () => {
      const next = turns.shift();
      if (!next) throw new Error('no more turns');
      if (next instanceof Error) throw next;
      return next;
    }),
    review: vi.fn(async () => {
      if (reviewResult instanceof Error) throw reviewResult;
      return reviewResult;
    }),
  };
  const deps = {
    model,
    speak: vi.fn(),
    saveMistakes: vi.fn(async () => {}),
    saveSession: vi.fn(async () => {}),
  };
  const states: SessionState[] = [];
  const session = new ChatSession(mode, 'SYS', deps, (s) => states.push(s));
  return { session, model, deps, states };
}

describe('ChatSession', () => {
  it('starts with the AI opener and speaks it', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi! What can I get you?' }]);
    await session.start();
    expect(model.turn).toHaveBeenCalledWith('SYS', [], false);
    expect(session.getState()).toMatchObject({ status: 'ready', error: null, turns: [{ role: 'ai', text: 'Hi! What can I get you?' }] });
    expect(deps.speak).toHaveBeenCalledWith('Hi! What can I get you?');
  });

  it('ignores blank input', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }]);
    await session.start();
    expect(await session.send('   ')).toBe(false);
    expect(model.turn).toHaveBeenCalledTimes(1);
  });

  it('in each mode attaches feedback to the user turn and saves it', async () => {
    const { session, model, deps } = setup('each', [{ reply: 'For here or to go?' }, { reply: 'Great.', feedback: fb }]);
    await session.start();
    expect(await session.send(' hear ')).toBe(true);
    expect(model.turn).toHaveBeenLastCalledWith('SYS', [
      { role: 'ai', text: 'For here or to go?' },
      { role: 'user', text: 'hear' },
    ], true);
    expect(session.getState().turns).toEqual([
      { role: 'ai', text: 'For here or to go?' },
      { role: 'user', text: 'hear', feedback: fb },
      { role: 'ai', text: 'Great.' },
    ]);
    expect(deps.saveMistakes).toHaveBeenCalledWith([fb]);
    expect(deps.speak).toHaveBeenLastCalledWith('Great.');
  });

  it('in after mode does not request or save feedback per turn', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi' }, { reply: 'Sure.' }]);
    await session.start();
    await session.send('cold brew please');
    expect(model.turn).toHaveBeenLastCalledWith('SYS', expect.any(Array), false);
    expect(deps.saveMistakes).not.toHaveBeenCalled();
  });

  it('ignores a second send while waiting', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }, { reply: 'Ok' }]);
    await session.start();
    const first = session.send('one');
    expect(await session.send('two')).toBe(false);
    await first;
    expect(model.turn).toHaveBeenCalledTimes(2);
    expect(session.getState().turns.filter((t) => t.role === 'user').map((t) => t.text)).toEqual(['one']);
  });

  it('marks the user turn failed and retry resends it', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }, new AiError('unavailable'), { reply: 'Back!' }]);
    await session.start();
    await session.send('hello');
    expect(session.getState().turns.at(-1)).toEqual({ role: 'user', text: 'hello', failed: true });
    expect(session.getState().error?.kind).toBe('unavailable');
    expect(await session.send('another')).toBe(false);

    await session.retry();
    expect(model.turn).toHaveBeenCalledTimes(3);
    expect(session.getState()).toMatchObject({ status: 'ready', error: null });
    expect(session.getState().turns.map((t) => t.text)).toEqual(['Hi', 'hello', 'Back!']);
  });

  it('wraps unknown errors as bad_response', async () => {
    const { session } = setup('after', [{ reply: 'Hi' }, new Error('boom')]);
    await session.start();
    await session.send('hello');
    expect(session.getState().error?.kind).toBe('bad_response');
  });

  it('retry after a failed start runs start again', async () => {
    const { session, model } = setup('after', [new AiError('no_key'), { reply: 'Hi' }]);
    await session.start();
    expect(session.getState()).toMatchObject({ status: 'idle', turns: [] });
    expect(session.getState().error?.kind).toBe('no_key');
    await session.retry();
    expect(model.turn).toHaveBeenCalledTimes(2);
    expect(session.getState().status).toBe('ready');
  });

  it('finish in after mode reviews the transcript and saves corrections and session', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi' }, { reply: 'Sure.' }]);
    await session.start();
    await session.send('cold brew please');
    const result = await session.finish();
    expect(result).toEqual(review);
    expect(model.review).toHaveBeenCalledWith(expect.stringContaining('ME:'), 'PARTNER: Hi\nME: cold brew please\nPARTNER: Sure.');
    expect(deps.saveMistakes).toHaveBeenCalledWith(review.corrections);
    expect(deps.saveSession).toHaveBeenCalledWith([
      { role: 'ai', text: 'Hi' }, { role: 'user', text: 'cold brew please' }, { role: 'ai', text: 'Sure.' },
    ]);
    expect(session.getState().status).toBe('done');
  });

  it('finish in each mode does not save review corrections again', async () => {
    const { session, deps } = setup('each', [{ reply: 'Hi' }, { reply: 'Ok', feedback: fb }]);
    await session.start();
    await session.send('hear');
    await session.finish();
    expect(deps.saveMistakes).toHaveBeenCalledTimes(1);
  });

  it('finish without any user turn returns an empty review without calling the model', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }]);
    await session.start();
    expect(await session.finish()).toEqual({ corrections: [], phrases: [], summary_ko: '대화한 내용이 없어요.' });
    expect(model.review).not.toHaveBeenCalled();
  });

  it('finish failure keeps the session usable', async () => {
    const { session } = setup('after', [{ reply: 'Hi' }, { reply: 'Ok' }], new AiError('rate_limit'));
    await session.start();
    await session.send('hello');
    expect(await session.finish()).toBeNull();
    expect(session.getState()).toMatchObject({ status: 'ready' });
    expect(session.getState().error?.kind).toBe('rate_limit');
  });

  it('after dispose, a pending reply is neither spoken nor published', async () => {
    let resolve!: (r: TurnResult) => void;
    const { session, model, deps, states } = setup('after', []);
    (model.turn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<TurnResult>((r) => { resolve = r; }));
    const started = session.start();
    const before = states.length;
    session.dispose();
    resolve({ reply: 'Too late' });
    await started;
    expect(deps.speak).not.toHaveBeenCalled();
    expect(states.length).toBe(before);
  });

  it('after dispose, a pending finish returns null', async () => {
    let resolve!: (r: SessionReview) => void;
    const { session, model } = setup('after', [{ reply: 'Hi' }, { reply: 'Ok' }]);
    await session.start();
    await session.send('hello');
    (model.review as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<SessionReview>((r) => { resolve = r; }));
    const finishing = session.finish();
    session.dispose();
    resolve(review);
    expect(await finishing).toBeNull();
  });
});
