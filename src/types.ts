export const CATEGORIES = [
  'missing_verb', 'tense', 'article', 'word_choice',
  'word_order', 'expression', 'adj_adv', 'culture',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Correction {
  original: string;
  better: string;
  point_ko: string;
  category: Category;
  ok: boolean;
}

export interface Phrase {
  en: string;
  ko: string;
}

export interface SessionReview {
  corrections: Correction[];
  phrases: Phrase[];
  summary_ko: string;
}

export interface TurnResult {
  reply: string;
  feedback?: Correction;
}

export type Mode = 'after' | 'each';

export interface Turn {
  role: 'user' | 'ai';
  text: string;
}

export interface Scenario {
  id: string;
  emoji: string;
  title_ko: string;
  role_en: string;
  setting_en: string;
}

export interface Settings {
  apiKey: string;
  model: string;
  rate: number;
  voiceURI: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  rate: 0.9,
  voiceURI: null,
};

export interface MistakeEntry extends Correction {
  id: string;
  at: number;
  scenarioId: string;
}

export interface FocusItem {
  category: Category;
  count: number;
  examples: { original: string; better: string }[];
}
