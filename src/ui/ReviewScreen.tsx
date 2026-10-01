import type { SessionReview } from '../types';
import { CorrectionCard } from './CorrectionCard';

interface Props {
  review: SessionReview;
  onHome: () => void;
  onNotes: () => void;
}

export function ReviewScreen({ review, onHome, onNotes }: Props) {
  return (
    <div class="screen">
      <header class="bar">
        <h1>🎉 오늘의 교정</h1>
      </header>
      {review.summary_ko && <div class="card">{review.summary_ko}</div>}

      <h2>고칠 문장 {review.corrections.length}개</h2>
      {review.corrections.length === 0 && <p class="muted">고칠 문장이 없어요. 아주 잘했어요!</p>}
      {review.corrections.map((c, i) => (
        <CorrectionCard key={i} c={c} />
      ))}

      {review.phrases.length > 0 && (
        <>
          <h2>오늘 배운 표현</h2>
          <table>
            <tbody>
              {review.phrases.map((p, i) => (
                <tr key={i}>
                  <td><b>{p.en}</b></td>
                  <td>{p.ko}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div class="row">
        <button onClick={onNotes}>📒 실수 노트</button>
        <button class="primary" onClick={onHome}>홈으로</button>
      </div>
    </div>
  );
}
