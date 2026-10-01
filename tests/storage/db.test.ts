import 'fake-indexeddb/auto';
import { clear, get } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMistakes, loadMistakes, loadSettings, saveSession, saveSettings } from '../../src/storage/db';
import { DEFAULT_SETTINGS, type MistakeEntry } from '../../src/types';

const entry = (id: string, at: number): MistakeEntry => ({
  id, at, scenarioId: 'cafe', original: 'o', better: 'b', point_ko: 'p', category: 'tense', ok: true,
});

beforeEach(async () => {
  await clear();
});

describe('settings', () => {
  it('returns defaults when nothing is saved', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'test-key', rate: 1 });
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, apiKey: 'test-key', rate: 1 });
  });
});

describe('mistakes', () => {
  it('keeps newest entries first', async () => {
    await addMistakes([entry('a', 1)]);
    await addMistakes([entry('b', 2)]);
    expect((await loadMistakes()).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('ignores an empty batch', async () => {
    await addMistakes([]);
    expect(await loadMistakes()).toEqual([]);
  });
});

describe('sessions', () => {
  it('stores session records newest first', async () => {
    await saveSession({ at: 1, scenarioId: 'cafe', mode: 'after', turns: [{ role: 'user', text: 'hi' }] });
    await saveSession({ at: 2, scenarioId: 'hotel', mode: 'each', turns: [] });
    const saved = await get<{ at: number }[]>('sessions');
    expect(saved?.map((s) => s.at)).toEqual([2, 1]);
  });
});
