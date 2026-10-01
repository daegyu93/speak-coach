import { useState } from 'preact/hooks';
import { makeCustomScenario, SCENARIOS } from '../scenarios/scenarios';
import type { Mode, Scenario } from '../types';

interface Props {
  hasKey: boolean;
  onStart: (scenario: Scenario, mode: Mode) => void;
  onNotes: () => void;
  onSettings: () => void;
}

export function HomeScreen({ hasKey, onStart, onNotes, onSettings }: Props) {
  const [mode, setMode] = useState<Mode>('after');
  const [custom, setCustom] = useState('');

  return (
    <div class="screen">
      <header class="bar">
        <h1>Speak Coach</h1>
        <button onClick={onNotes}>📒 노트</button>
        <button onClick={onSettings} aria-label="설정">⚙️</button>
      </header>
      {!hasKey && <p class="error">먼저 ⚙️ 설정에서 Gemini API 키를 입력해 주세요.</p>}
      <div class="seg">
        <button class={mode === 'after' ? 'on' : ''} onClick={() => setMode('after')}>대화 후 교정</button>
        <button class={mode === 'each' ? 'on' : ''} onClick={() => setMode('each')}>문장마다 교정</button>
      </div>
      <div class="list">
        {SCENARIOS.map((s) => (
          <button key={s.id} disabled={!hasKey} onClick={() => onStart(s, mode)}>
            {s.emoji} {s.title_ko}
          </button>
        ))}
      </div>
      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const scenario = makeCustomScenario(custom);
          if (scenario) onStart(scenario, mode);
        }}
      >
        <input value={custom} onInput={(e) => setCustom(e.currentTarget.value)} placeholder="직접 상황 입력 (예: 렌터카 빌리기)" />
        <button class="primary" disabled={!hasKey || !custom.trim()}>시작</button>
      </form>
    </div>
  );
}
