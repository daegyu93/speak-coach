export type AiErrorKind = 'no_key' | 'bad_key' | 'rate_limit' | 'unavailable' | 'network' | 'bad_response';

export class AiError extends Error {
  constructor(readonly kind: AiErrorKind, message: string = kind) {
    super(message);
    this.name = 'AiError';
  }
}

export const AI_ERROR_KO: Record<AiErrorKind, string> = {
  no_key: '⚙️ 설정에서 Gemini API 키를 입력해 주세요.',
  bad_key: 'API 키가 올바르지 않아요. ⚙️ 설정에서 확인해 주세요.',
  rate_limit: '무료 사용 한도에 걸렸어요. 1분쯤 뒤에 다시 보내 주세요.',
  unavailable: 'Gemini 서버가 혼잡해요. 잠시 후 다시 보내 주세요. 계속되면 설정에서 모델을 바꿔 보세요.',
  network: '인터넷 연결을 확인하고 다시 보내 주세요.',
  bad_response: 'AI 응답을 읽지 못했어요. 다시 보내 주세요.',
};
