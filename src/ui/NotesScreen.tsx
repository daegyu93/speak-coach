import { useEffect, useState } from 'preact/hooks';
import { loadMistakes } from '../storage/db';
import { buildFocus } from '../storage/mistakes';
import type { MistakeEntry } from '../types';
import { CorrectionCard } from './CorrectionCard';
import { CATEGORY_KO } from './labels';

const SHOW_LIMIT = 100;

export function NotesScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<MistakeEntry[] | null>(null);

  useEffect(() => {
    loadMistakes().then(setEntries);
  }, []);

  if (!entries) return null;
  const focus = buildFocus(entries);

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onBack} aria-label="뒤로">←</button>
        <h1>📒 실수 노트</h1>
      </header>

      {entries.length === 0 && <p class="muted">아직 저장된 교정이 없어요. 대화를 끝내면 여기에 모여요.</p>}

      {focus.length > 0 && (
        <div class="card">
          <b>자주 틀리는 유형 TOP {focus.length}</b>
          {focus.map((f, i) => (
            <div key={f.category}>
              {i + 1}. {CATEGORY_KO[f.category]} — {f.count}번
            </div>
          ))}
          <span class="muted">다음 대화에서 AI가 이 유형을 연습할 기회를 만들어 줘요.</span>
        </div>
      )}

      {entries.slice(0, SHOW_LIMIT).map((e) => (
        <div key={e.id}>
          <div class="muted">{new Date(e.at).toLocaleDateString('ko-KR')}</div>
          <CorrectionCard c={e} />
        </div>
      ))}
    </div>
  );
}
