import { get, set } from 'idb-keyval';
import { DEFAULT_SETTINGS, type MistakeEntry, type Mode, type Settings, type Turn } from '../types';

const MAX_MISTAKES = 500;
const MAX_SESSIONS = 50;

export interface SessionRecord {
  at: number;
  scenarioId: string;
  mode: Mode;
  turns: Turn[];
}

export async function loadSettings(): Promise<Settings> {
  const saved = await get<Partial<Settings>>('settings');
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await set('settings', s);
}

export async function loadMistakes(): Promise<MistakeEntry[]> {
  return (await get<MistakeEntry[]>('mistakes')) ?? [];
}

export async function addMistakes(entries: MistakeEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const all = [...entries, ...(await loadMistakes())].slice(0, MAX_MISTAKES);
  await set('mistakes', all);
}

export async function saveSession(r: SessionRecord): Promise<void> {
  const all = [r, ...((await get<SessionRecord[]>('sessions')) ?? [])].slice(0, MAX_SESSIONS);
  await set('sessions', all);
}
