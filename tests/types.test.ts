import { describe, expect, it } from 'vitest';
import { CATEGORIES, DEFAULT_SETTINGS } from '../src/types';

describe('types', () => {
  it('has the eight correction categories from the spec', () => {
    expect([...CATEGORIES]).toEqual([
      'missing_verb', 'tense', 'article', 'word_choice',
      'word_order', 'expression', 'adj_adv', 'culture',
    ]);
  });

  it('defaults to gemini-3.5-flash-lite with no API key', () => {
    expect(DEFAULT_SETTINGS).toEqual({ apiKey: '', model: 'gemini-3.5-flash-lite', rate: 0.9, voiceURI: null });
  });
});
