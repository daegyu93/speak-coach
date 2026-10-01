import { describe, expect, it } from 'vitest';
import { buildFocus, sameSentence, toEntries } from '../../src/storage/mistakes';
import type { Correction, MistakeEntry } from '../../src/types';

const c = (original: string, better: string, category: Correction['category'] = 'tense'): Correction => ({
  original, better, point_ko: '설명', category, ok: true,
});

const entry = (category: Correction['category'], at: number, original = `o${at}`): MistakeEntry => ({
  ...c(original, `b${at}`, category), id: String(at), at, scenarioId: 'cafe',
});

describe('sameSentence', () => {
  it('ignores case, punctuation and spaces', () => {
    expect(sameSentence('yes please', 'Yes, please.')).toBe(true);
    expect(sameSentence('yes i first time', "Yes, it's my first time.")).toBe(false);
  });
});

describe('toEntries', () => {
  it('stamps id, time and scenario', () => {
    const [e] = toEntries([c('i first time', "it's my first time")], 'immigration', 1000);
    expect(e).toMatchObject({ id: '1000-0', at: 1000, scenarioId: 'immigration', original: 'i first time' });
  });

  it('skips corrections whose better equals original', () => {
    const list = toEntries([c('Yes, please.', 'yes please'), c('hear', 'here')], 'cafe', 1);
    expect(list.map((e) => e.original)).toEqual(['hear']);
  });
});

describe('buildFocus', () => {
  it('returns top categories by count with newest examples first', () => {
    const entries = [
      entry('tense', 1), entry('tense', 5), entry('tense', 3),
      entry('article', 2), entry('article', 4),
      entry('culture', 6),
      entry('word_order', 7),
    ];
    const focus = buildFocus(entries, 3, 2);
    expect(focus.map((f) => [f.category, f.count])).toEqual([
      ['tense', 3], ['article', 2], ['word_order', 1],
    ]);
    expect(focus[0].examples).toEqual([
      { original: 'o5', better: 'b5' },
      { original: 'o3', better: 'b3' },
    ]);
  });

  it('returns an empty list for no entries', () => {
    expect(buildFocus([])).toEqual([]);
  });
});
