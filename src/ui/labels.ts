import { SpeechError } from '../speech/types';
import type { Category } from '../types';

export const CATEGORY_KO: Record<Category, string> = {
  missing_verb: '동사 누락',
  tense: '시제',
  article: '관사 (a/an/the)',
  word_choice: '단어 선택',
  word_order: '어순',
  expression: '표현·관용구',
  adj_adv: '형용사/부사 (-ed/-ing)',
  culture: '문화·뉘앙스',
};

export function speechMessage(err: unknown): string {
  if (err instanceof SpeechError) {
    if (err.kind === 'unsupported') return '이 브라우저는 음성 인식을 지원하지 않아요. 아래 칸에 입력해 주세요.';
    if (err.kind === 'permission') return '마이크 권한이 필요해요. 브라우저 설정에서 허용해 주세요. 그동안은 아래 칸에 입력해 주세요.';
  }
  return '음성 인식에 문제가 생겼어요. 다시 누르거나 아래 칸에 입력해 주세요.';
}
