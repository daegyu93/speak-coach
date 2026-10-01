import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../../src/ai/errors';
import { GeminiChatModel } from '../../src/ai/gemini';
import { START_CUE } from '../../src/ai/prompt';

const okBody = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

const errBody = (status: number, message = 'error') =>
  new Response(JSON.stringify({ error: { code: status, message } }), { status });

function setup(...responses: (Response | Error)[]) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const model = new GeminiChatModel({
    apiKey: 'test-key', model: 'gemini-2.5-flash',
    fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {},
  });
  return { model, fetchFn };
}

async function kindOf(p: Promise<unknown>) {
  try { await p; return 'resolved'; } catch (e) { return e instanceof AiError ? e.kind : 'other'; }
}

describe('GeminiChatModel.turn', () => {
  it('posts system prompt, start cue and mapped history with the reply schema', async () => {
    const { model, fetchFn } = setup(okBody({ reply: 'Hi there!' }));
    const res = await model.turn('SYS', [{ role: 'ai', text: 'Hello' }, { role: 'user', text: 'hi' }], false);
    expect(res).toEqual({ reply: 'Hi there!' });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: START_CUE }] },
      { role: 'model', parts: [{ text: 'Hello' }] },
      { role: 'user', parts: [{ text: 'hi' }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(['reply']);
  });

  it('uses the feedback schema and returns feedback when requested', async () => {
    const feedback = { original: 'hear', better: 'here', point_ko: '철자', category: 'word_choice', ok: true };
    const { model, fetchFn } = setup(okBody({ feedback, reply: 'Got it.' }));
    const res = await model.turn('SYS', [{ role: 'ai', text: 'For here?' }, { role: 'user', text: 'hear' }], true);
    expect(res).toEqual({ reply: 'Got it.', feedback });
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseSchema.required).toEqual(['feedback', 'reply']);
  });

  it('uses the reply-only schema for the opener even in feedback mode', async () => {
    const { model, fetchFn } = setup(okBody({ reply: 'Next, please!' }));
    await model.turn('SYS', [], true);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseSchema.required).toEqual(['reply']);
  });

  it('throws no_key without calling fetch when the key is blank', async () => {
    const fetchFn = vi.fn();
    const model = new GeminiChatModel({ apiKey: '  ', model: 'm', fetchFn: fetchFn as unknown as typeof fetch });
    expect(await kindOf(model.turn('SYS', [], false))).toBe('no_key');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('retries once on 503', async () => {
    const { model, fetchFn } = setup(errBody(503, 'high demand'), okBody({ reply: 'Back!' }));
    expect(await model.turn('SYS', [], false)).toEqual({ reply: 'Back!' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws unavailable after two 503s', async () => {
    const { model, fetchFn } = setup(errBody(503), errBody(503));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('unavailable');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries once on 429 then reports rate_limit', async () => {
    const { model } = setup(errBody(429), errBody(429));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('rate_limit');
  });

  it('maps a per-day quota 429 to daily_limit without retrying', async () => {
    const body = JSON.stringify({ error: { code: 429, message: 'quota', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }] } });
    const { model, fetchFn } = setup(new Response(body, { status: 429 }), okBody({ reply: 'never' }));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('daily_limit');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps an unknown model name to bad_model without retrying', async () => {
    const { model, fetchFn } = setup(errBody(404, 'models/gemini-typo is not found for API version v1beta'), okBody({ reply: 'never' }));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('bad_model');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps an invalid key to bad_key without retrying', async () => {
    const { model, fetchFn } = setup(errBody(400, 'API key not valid. Please pass a valid API key.'));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('bad_key');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps a thrown fetch to network without retrying', async () => {
    const { model, fetchFn } = setup(new TypeError('Failed to fetch'));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('network');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries once when the JSON is broken', async () => {
    const broken = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":' }] } }] }), { status: 200 });
    const { model } = setup(broken, okBody({ reply: 'Fixed' }));
    expect(await model.turn('SYS', [], false)).toEqual({ reply: 'Fixed' });
  });
});

describe('GeminiChatModel.review', () => {
  it('sends the transcript and parses the review', async () => {
    const review = { corrections: [], phrases: [{ en: 'Here you are.', ko: '여기 있어요' }], summary_ko: '좋아요' };
    const { model, fetchFn } = setup(okBody(review));
    expect(await model.review('REVIEW', 'ME: hi')).toEqual(review);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'ME: hi' }] }]);
    expect(body.generationConfig.responseSchema.required).toEqual(['corrections', 'phrases', 'summary_ko']);
  });
});
