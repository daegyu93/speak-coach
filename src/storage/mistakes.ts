import type { Category, Correction, FocusItem, MistakeEntry } from '../types';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function sameSentence(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function toEntries(corrections: Correction[], scenarioId: string, now = Date.now()): MistakeEntry[] {
  return corrections
    .filter((c) => !sameSentence(c.original, c.better))
    .map((c, i) => ({ ...c, id: `${now}-${i}`, at: now, scenarioId }));
}

export function buildFocus(entries: MistakeEntry[], n = 3, examplesPer = 2): FocusItem[] {
  const groups = new Map<Category, MistakeEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.category) ?? [];
    list.push(e);
    groups.set(e.category, list);
  }
  return [...groups.entries()]
    .map(([category, list]) => {
      const newest = [...list].sort((a, b) => b.at - a.at);
      return {
        category,
        count: list.length,
        latest: newest[0].at,
        examples: newest.slice(0, examplesPer).map(({ original, better }) => ({ original, better })),
      };
    })
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .slice(0, n)
    .map(({ category, count, examples }) => ({ category, count, examples }));
}
