export type SpeechErrorKind = 'unsupported' | 'permission' | 'failed';

export class SpeechError extends Error {
  constructor(readonly kind: SpeechErrorKind, message: string = kind) {
    super(message);
    this.name = 'SpeechError';
  }
}

export interface SpeechInput {
  readonly supported: boolean;
  start(): void;
  stop(): Promise<string>;
}

export interface VoiceInfo {
  name: string;
  voiceURI: string;
  lang: string;
}

export interface SpeechOutput {
  readonly supported: boolean;
  speak(text: string, opts: { rate: number; voiceURI: string | null }): Promise<void>;
  cancel(): void;
  voices(): VoiceInfo[];
  onVoicesChanged(cb: () => void): () => void;
}
