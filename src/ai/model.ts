import type { SessionReview, Turn, TurnResult } from '../types';

export interface ChatModel {
  turn(system: string, history: Turn[], withFeedback: boolean): Promise<TurnResult>;
  review(system: string, transcript: string): Promise<SessionReview>;
}
