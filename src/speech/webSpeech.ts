import { SpeechError, type SpeechInput, type SpeechOutput, type VoiceInfo } from './types';

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// 안드로이드 크롬은 continuous 모드에서 "I want", "I want to go"처럼 앞 결과를 포함한 결과를 다시 보낸다.
// 다음 결과가 앞 결과로 시작하면 앞 결과를 버린다.
function collapseResults(parts: string[]): string[] {
  const kept: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    const prev = kept.at(-1);
    if (prev !== undefined && p.toLowerCase().startsWith(prev.toLowerCase())) kept[kept.length - 1] = p;
    else kept.push(p);
  }
  return kept;
}

export class WebSpeechInput implements SpeechInput {
  private rec: RecognitionLike | null = null;
  private text = '';
  private error: string | null = null;
  private ended: Promise<void> = Promise.resolve();

  constructor(private readonly Ctor: RecognitionCtor | null = getRecognitionCtor()) {}

  get supported(): boolean {
    return this.Ctor !== null;
  }

  start(): void {
    if (!this.Ctor) throw new SpeechError('unsupported');
    this.rec?.stop();
    const rec = new this.Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    this.text = '';
    this.error = null;
    // results는 지금까지의 전체 목록이라 매번 처음부터 다시 이어 붙인다 (미확정 결과 포함).
    rec.onresult = (e) => {
      this.text = collapseResults(Array.from(e.results, (r) => r[0]?.transcript.trim() ?? '')).join(' ');
    };
    rec.onerror = (e) => {
      this.error = e.error;
    };
    this.ended = new Promise((resolve) => {
      rec.onend = () => resolve();
    });
    this.rec = rec;
    rec.start();
  }

  async stop(): Promise<string> {
    const rec = this.rec;
    if (!rec) return '';
    rec.stop();
    await this.ended;
    this.rec = null;
    if (this.error === 'not-allowed' || this.error === 'service-not-allowed') throw new SpeechError('permission');
    if (this.error && this.error !== 'no-speech' && this.error !== 'aborted') throw new SpeechError('failed', this.error);
    return this.text;
  }
}

export class WebSpeechOutput implements SpeechOutput {
  constructor(private readonly synth: SpeechSynthesis | null = globalThis.speechSynthesis ?? null) {}

  get supported(): boolean {
    return this.synth !== null;
  }

  voices(): VoiceInfo[] {
    return (this.synth?.getVoices() ?? [])
      .filter((v) => v.lang.startsWith('en'))
      .map(({ name, voiceURI, lang }) => ({ name, voiceURI, lang }));
  }

  onVoicesChanged(cb: () => void): () => void {
    const synth = this.synth;
    if (!synth) return () => {};
    synth.addEventListener('voiceschanged', cb);
    return () => synth.removeEventListener('voiceschanged', cb);
  }

  speak(text: string, { rate, voiceURI }: { rate: number; voiceURI: string | null }): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();
    synth.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      const voice = voiceURI ? synth.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}
