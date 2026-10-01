import { describe, expect, it } from 'vitest';
import { SpeechError } from '../../src/speech/types';
import { WebSpeechInput, WebSpeechOutput } from '../../src/speech/webSpeech';

type Handler<T> = ((e: T) => void) | null;

class FakeRec {
  static last: FakeRec;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: Handler<{ results: ArrayLike<ArrayLike<{ transcript: string }>> }> = null;
  onerror: Handler<{ error: string }> = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() { FakeRec.last = this; }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  emit(...texts: string[]) { this.onresult?.({ results: texts.map((t) => [{ transcript: t }]) }); }
  fail(error: string) { this.onerror?.({ error }); }
}

describe('WebSpeechInput', () => {
  it('reports unsupported when no recognition constructor exists', () => {
    const input = new WebSpeechInput(null);
    expect(input.supported).toBe(false);
    expect(() => input.start()).toThrowError(SpeechError);
  });

  it('configures English continuous recognition', () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    expect(FakeRec.last).toMatchObject({ lang: 'en-US', continuous: true, interimResults: true, started: true });
  });

  it('returns the full latest transcript on stop', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.emit('cold');
    FakeRec.last.emit('cold brew', ' please ');
    expect(await input.stop()).toBe('cold brew please');
  });

  it('collapses growing duplicate results reported by Android Chrome', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.emit('I want', 'I want to go', 'I want to go to the hotel');
    expect(await input.stop()).toBe('I want to go to the hotel');
  });

  it('keeps separate segments that do not repeat each other', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.emit('I want to go', 'to the hotel');
    expect(await input.stop()).toBe('I want to go to the hotel');
  });

  it('returns empty string on no-speech', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.fail('no-speech');
    expect(await input.stop()).toBe('');
  });

  it('throws permission when the microphone is blocked', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.fail('not-allowed');
    await expect(input.stop()).rejects.toMatchObject({ kind: 'permission' });
  });

  it('returns empty string when stop is called without start', async () => {
    expect(await new WebSpeechInput(FakeRec).stop()).toBe('');
  });
});

describe('WebSpeechOutput', () => {
  it('lists only English voices', () => {
    const synth = {
      getVoices: () => [
        { name: 'Samantha', voiceURI: 'sam', lang: 'en-US' },
        { name: 'Yuna', voiceURI: 'yuna', lang: 'ko-KR' },
      ],
    } as unknown as SpeechSynthesis;
    expect(new WebSpeechOutput(synth).voices()).toEqual([{ name: 'Samantha', voiceURI: 'sam', lang: 'en-US' }]);
  });

  it('is unsupported and silent without speechSynthesis', async () => {
    const out = new WebSpeechOutput(null);
    expect(out.supported).toBe(false);
    await expect(out.speak('hi', { rate: 1, voiceURI: null })).resolves.toBeUndefined();
  });
});
