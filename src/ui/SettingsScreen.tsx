import { useEffect, useState } from 'preact/hooks';
import type { SpeechOutput, VoiceInfo } from '../speech/types';
import { DEFAULT_SETTINGS, type Settings } from '../types';

interface Props {
  settings: Settings;
  output: SpeechOutput;
  onSave: (s: Settings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, output, onSave, onBack }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [voices, setVoices] = useState<VoiceInfo[]>(() => output.voices());

  useEffect(() => output.onVoicesChanged(() => setVoices(output.voices())), [output]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onBack} aria-label="뒤로">←</button>
        <h1>설정</h1>
      </header>
      <label>
        Gemini API 키
        <input type="password" autocomplete="off" value={draft.apiKey} onInput={(e) => set('apiKey', e.currentTarget.value.trim())} />
        <span class="muted">Google AI Studio에서 무료로 발급받을 수 있어요. 키는 이 폰에만 저장돼요.</span>
      </label>
      <label>
        모델
        <input value={draft.model} onInput={(e) => set('model', e.currentTarget.value.trim() || DEFAULT_SETTINGS.model)} />
        <span class="muted">기본값 {DEFAULT_SETTINGS.model}. 서버가 계속 혼잡하면 다른 Flash 모델로 바꿔 보세요.</span>
      </label>
      <label>
        말하기 속도: {draft.rate.toFixed(1)}
        <input type="range" min="0.6" max="1.2" step="0.1" value={draft.rate} onInput={(e) => set('rate', Number(e.currentTarget.value))} />
      </label>
      <label>
        목소리
        <select value={draft.voiceURI ?? ''} onChange={(e) => set('voiceURI', e.currentTarget.value || null)}>
          <option value="">기본 영어 목소리</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>
      </label>
      <div class="row">
        <button onClick={() => output.speak('Hi, nice to meet you. Welcome to GTC!', { rate: draft.rate, voiceURI: draft.voiceURI })}>
          🔊 목소리 듣기
        </button>
        <button class="primary" onClick={() => onSave(draft)}>저장</button>
      </div>
    </div>
  );
}
