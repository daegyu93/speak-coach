import { sameSentence } from '../storage/mistakes';
import type { Correction } from '../types';
import { CATEGORY_KO } from './labels';

export function CorrectionCard({ c }: { c: Correction }) {
  const perfect = sameSentence(c.original, c.better);
  return (
    <div class="card">
      <div class="tag">
        {perfect ? '✅ 완벽해요' : c.ok ? '✅ 뜻은 통해요' : '⚠️ 다시 보기'}
        {!perfect && ` · ${CATEGORY_KO[c.category]}`}
      </div>
      {!perfect && <div class="orig">{c.original}</div>}
      <div class="better">{perfect ? c.better : `→ ${c.better}`}</div>
      {c.point_ko && <div>{c.point_ko}</div>}
    </div>
  );
}
