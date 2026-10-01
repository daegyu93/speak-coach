# speak-coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안드로이드 크롬에서 상황을 고르고 음성으로 AI와 영어 대화를 한 뒤 한국어 교정을 받는 개인용 PWA를 만든다.

**Architecture:** 서버가 없는 정적 웹앱이다. 브라우저 Web Speech API로 말을 텍스트로 바꾸고, 브라우저에서 Gemini REST API(JSON 스키마 출력)를 직접 호출하고, speechSynthesis로 답변을 읽어 준다. 대화 흐름은 DOM과 무관한 `ChatSession` 컨트롤러가 담당하고, AI(`ChatModel`)와 음성(`SpeechInput`/`SpeechOutput`)은 인터페이스 뒤에 숨겨서 교체할 수 있게 한다. 데이터는 IndexedDB(idb-keyval)에 저장한다.

**Tech Stack:** Vite, TypeScript, Preact, idb-keyval, Vitest, fake-indexeddb, vite-plugin-pwa, @vite-pwa/assets-generator, GitHub Pages(Actions)

**Spec:** `docs/superpowers/specs/2026-10-01-speak-coach-design.md`

## Global Constraints

- 서버 없음. Gemini는 브라우저에서 `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`로 직접 호출하고, 키는 `x-goog-api-key` 헤더로 보낸다.
- API 키는 설정 화면에서 입력받아 IndexedDB에만 저장한다. **어떤 파일, 테스트, 커밋에도 실제 키를 넣지 않는다.**
- 기본 모델은 `gemini-2.5-flash`이고 설정에서 바꿀 수 있다. (2026-10-01 확인: 이 모델은 JSON 스키마 출력이 정상 동작했고, `gemini-flash-latest`는 503 "high demand"를 반환했다.)
- 배포 경로는 GitHub Pages `https://daegyu93.github.io/speak-coach/`이고, Vite `base`는 `/speak-coach/`이다.
- 화면 문구는 한국어, AI 대사는 영어, 교정 설명(`point_ko`)·표현 뜻(`ko`)·총평(`summary_ko`)은 한국어로 한다.
- 대상 환경은 안드로이드 크롬이다. 마이크는 HTTPS 또는 localhost에서만 동작한다.
- 교정 카테고리는 정확히 `missing_verb | tense | article | word_choice | word_order | expression | adj_adv | culture` 8개다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 줄을 붙인다. 커밋 이메일은 저장소의 기존 git 설정을 그대로 쓴다(사용자가 선택함).
- Node 24(로컬 v24.15.0)를 기준으로 한다.

## Review Focus

1. **Gemini 503 "high demand"/429**: 계획 작성 중 실제로 발생했다. 1회 자동 재시도 후에도 실패하면 한국어 안내와 "다시 보내기"를 보여 줘야 한다. → Task 5 테스트 `retries once on 503`, `throws unavailable after two 503s`, Task 7 테스트 `marks the user turn failed and retry resends it`
2. **음성 인식 결과가 빈 문자열**: 짧게 누르거나 말이 없거나 `no-speech` 오류가 나면 전송하지 않고 "잘 안 들렸어요"를 띄워야 한다. → Task 6 테스트 `returns empty string on no-speech`, Task 7 테스트 `ignores blank input`
3. **응답 대기 중 두 번 전송**: 버튼을 연타해도 두 번째 전송은 무시해야 한다. → Task 7 테스트 `ignores a second send while waiting`
4. **이미 자연스러운 문장을 "교정"으로 돌려줌**(better == original): ✅로 보여 주고 실수 노트에는 저장하지 않는다. → Task 2 테스트 `skips corrections whose better equals original`
5. **모델이 모르는 category나 ```json 펜스로 감싼 JSON을 돌려줌**: 앱이 깨지지 않고 받아들인다. → Task 3 테스트 `maps unknown category to expression and missing ok to true`, `strips code fences`

---

## File Structure

```
speak-coach/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ public/icon.svg                     (Task 11: 앱 아이콘 원본, PNG는 생성)
├─ .github/workflows/deploy.yml        (Task 11)
├─ src/
│  ├─ main.tsx                         진입점
│  ├─ types.ts                         공용 타입·상수
│  ├─ storage/mistakes.ts              실수 노트 순수 로직 (변환, TOP 3)
│  ├─ storage/db.ts                    IndexedDB 읽기/쓰기 (설정, 실수, 세션)
│  ├─ ai/errors.ts                     AiError + 한국어 메시지
│  ├─ ai/schema.ts                     Gemini 응답 스키마 + 파싱·검증
│  ├─ ai/prompt.ts                     시스템 프롬프트, 교정 프롬프트, 대화록 포맷
│  ├─ ai/model.ts                      ChatModel 인터페이스
│  ├─ ai/gemini.ts                     GeminiChatModel (fetch, 재시도, 오류 매핑)
│  ├─ scenarios/scenarios.ts           상황 목록 + 직접 입력
│  ├─ speech/types.ts                  SpeechInput/SpeechOutput 인터페이스, SpeechError
│  ├─ speech/webSpeech.ts              Web Speech API 구현
│  ├─ chat/session.ts                  ChatSession 대화 컨트롤러
│  └─ ui/
│     ├─ styles.css
│     ├─ labels.ts                     카테고리 한국어 이름, 음성 오류 메시지
│     ├─ App.tsx                       화면 전환
│     ├─ HomeScreen.tsx
│     ├─ SettingsScreen.tsx
│     ├─ CorrectionCard.tsx
│     ├─ ChatScreen.tsx
│     ├─ ReviewScreen.tsx
│     └─ NotesScreen.tsx
└─ tests/  (src 구조를 그대로 따름)
```

---

### Task 1: 프로젝트 뼈대와 공용 타입

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces (`src/types.ts`):
  - `CATEGORIES: readonly ['missing_verb','tense','article','word_choice','word_order','expression','adj_adv','culture']`
  - `type Category`, `interface Correction { original; better; point_ko; category: Category; ok: boolean }`
  - `interface Phrase { en: string; ko: string }`
  - `interface SessionReview { corrections: Correction[]; phrases: Phrase[]; summary_ko: string }`
  - `interface TurnResult { reply: string; feedback?: Correction }`
  - `type Mode = 'after' | 'each'`
  - `interface Turn { role: 'user' | 'ai'; text: string }`
  - `interface Scenario { id; emoji; title_ko; role_en; setting_en }` (모두 string)
  - `interface Settings { apiKey: string; model: string; rate: number; voiceURI: string | null }`, `DEFAULT_SETTINGS`
  - `interface MistakeEntry extends Correction { id: string; at: number; scenarioId: string }`
  - `interface FocusItem { category: Category; count: number; examples: { original: string; better: string }[] }`

- [ ] **Step 1: npm 프로젝트 만들고 의존성 설치**

`~/work/english/speak-coach`에서 실행한다.

```bash
cd ~/work/english/speak-coach
cat > package.json <<'EOF'
{
  "name": "speak-coach",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
EOF
npm i preact idb-keyval
npm i -D vite @preact/preset-vite typescript vitest fake-indexeddb
```

Expected: `node_modules/` 생성, 오류 없음.

- [ ] **Step 2: 설정 파일 작성**

`.gitignore`:
```
node_modules
dist
dev-dist
*.local
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/speak-coach/',
  plugins: [preact()],
  test: { environment: 'node' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1f6feb" />
    <title>Speak Coach</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tests/types.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, DEFAULT_SETTINGS } from '../src/types';

describe('types', () => {
  it('has the eight correction categories from the spec', () => {
    expect([...CATEGORIES]).toEqual([
      'missing_verb', 'tense', 'article', 'word_choice',
      'word_order', 'expression', 'adj_adv', 'culture',
    ]);
  });

  it('defaults to gemini-2.5-flash with no API key', () => {
    expect(DEFAULT_SETTINGS).toEqual({ apiKey: '', model: 'gemini-2.5-flash', rate: 0.9, voiceURI: null });
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/types.test.ts`
Expected: FAIL — `Failed to resolve import "../src/types"`

- [ ] **Step 5: 타입과 진입점 구현**

`src/types.ts`:
```ts
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
```

`src/main.tsx` (Task 8에서 App으로 바꾼다):
```tsx
import { render } from 'preact';

render(<h1>Speak Coach</h1>, document.getElementById('app')!);
```

- [ ] **Step 6: 테스트와 빌드 통과 확인**

Run: `npm test && npm run build`
Expected: 테스트 2개 PASS, `dist/` 생성

- [ ] **Step 7: 커밋**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts index.html src tests
git commit -m "chore: scaffold Vite + Preact + Vitest project with shared types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 실수 노트 로직과 저장소

**Files:**
- Create: `src/storage/mistakes.ts`, `src/storage/db.ts`
- Test: `tests/storage/mistakes.test.ts`, `tests/storage/db.test.ts`

**Interfaces:**
- Consumes: `Correction`, `MistakeEntry`, `FocusItem`, `Category`, `Settings`, `DEFAULT_SETTINGS`, `Mode`, `Turn` (Task 1)
- Produces:
  - `sameSentence(a: string, b: string): boolean` — 대소문자, 구두점, 공백을 무시하고 비교
  - `toEntries(corrections: Correction[], scenarioId: string, now?: number): MistakeEntry[]` — 같은 문장은 제외
  - `buildFocus(entries: MistakeEntry[], n?: number, examplesPer?: number): FocusItem[]` — 개수 내림차순, 같으면 최근 순
  - `loadSettings(): Promise<Settings>`, `saveSettings(s: Settings): Promise<void>`
  - `loadMistakes(): Promise<MistakeEntry[]>` (최신 순), `addMistakes(entries: MistakeEntry[]): Promise<void>`
  - `interface SessionRecord { at: number; scenarioId: string; mode: Mode; turns: Turn[] }`, `saveSession(r: SessionRecord): Promise<void>`

- [ ] **Step 1: 실패하는 순수 로직 테스트 작성**

`tests/storage/mistakes.test.ts`:
```ts
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
```

참고: `word_order`(at 7)와 `culture`(at 6)는 둘 다 1개라서 더 최근인 `word_order`가 3위다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/storage/mistakes.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/storage/mistakes"`

- [ ] **Step 3: 순수 로직 구현**

`src/storage/mistakes.ts`:
```ts
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
```

- [ ] **Step 4: 순수 로직 테스트 통과 확인**

Run: `npx vitest run tests/storage/mistakes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 실패하는 저장소 테스트 작성**

`tests/storage/db.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'idb-keyval';
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
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/storage/db.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/storage/db"`

- [ ] **Step 7: 저장소 구현**

`src/storage/db.ts`:
```ts
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
```

- [ ] **Step 8: 전체 테스트 통과 확인**

Run: `npm test`
Expected: PASS (types 2 + mistakes 5 + db 5 = 12 tests)

- [ ] **Step 9: 커밋**

```bash
git add src/storage tests/storage
git commit -m "feat: add mistake notes logic and IndexedDB storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: AI 오류 타입과 응답 스키마·파싱

**Files:**
- Create: `src/ai/errors.ts`, `src/ai/schema.ts`
- Test: `tests/ai/schema.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `Category`, `Correction`, `SessionReview`, `TurnResult` (Task 1)
- Produces:
  - `type AiErrorKind = 'no_key' | 'bad_key' | 'rate_limit' | 'unavailable' | 'network' | 'bad_response'`
  - `class AiError extends Error { readonly kind: AiErrorKind }` — `new AiError(kind, message?)`
  - `AI_ERROR_KO: Record<AiErrorKind, string>`
  - `replySchema`, `replyWithFeedbackSchema`, `reviewSchema` (Gemini `responseSchema` 객체)
  - `parseJsonText(text: string): unknown`
  - `parseCorrection(raw: unknown): Correction | null`
  - `parseTurnResult(raw: unknown, withFeedback: boolean): TurnResult`
  - `parseSessionReview(raw: unknown): SessionReview`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ai/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { AiError } from '../../src/ai/errors';
import {
  parseJsonText, parseSessionReview, parseTurnResult, replyWithFeedbackSchema, reviewSchema,
} from '../../src/ai/schema';

const fb = { original: 'yes i first time', better: "Yes, it's my first time.", point_ko: '동사가 필요해요', category: 'missing_verb', ok: true };

describe('parseJsonText', () => {
  it('parses plain JSON', () => {
    expect(parseJsonText('{"reply":"Hi"}')).toEqual({ reply: 'Hi' });
  });

  it('strips code fences', () => {
    expect(parseJsonText('```json\n{"reply":"Hi"}\n```')).toEqual({ reply: 'Hi' });
  });

  it('throws bad_response on invalid JSON', () => {
    expect(() => parseJsonText('not json')).toThrowError(AiError);
    try { parseJsonText('nope'); } catch (e) { expect((e as AiError).kind).toBe('bad_response'); }
  });
});

describe('parseTurnResult', () => {
  it('returns reply only when feedback is not requested', () => {
    expect(parseTurnResult({ reply: ' Hi! ', feedback: fb }, false)).toEqual({ reply: 'Hi!' });
  });

  it('returns reply and feedback when requested', () => {
    expect(parseTurnResult({ reply: 'Welcome!', feedback: fb }, true)).toEqual({ reply: 'Welcome!', feedback: fb });
  });

  it('drops malformed feedback but keeps the reply', () => {
    expect(parseTurnResult({ reply: 'Ok', feedback: { original: '' } }, true)).toEqual({ reply: 'Ok' });
  });

  it('maps unknown category to expression and missing ok to true', () => {
    const r = parseTurnResult({ reply: 'Ok', feedback: { ...fb, category: 'pronunciation', ok: undefined } }, true);
    expect(r.feedback).toMatchObject({ category: 'expression', ok: true });
  });

  it('throws bad_response when reply is missing', () => {
    expect(() => parseTurnResult({ feedback: fb }, true)).toThrowError(AiError);
  });
});

describe('parseSessionReview', () => {
  it('parses corrections, phrases and summary', () => {
    const r = parseSessionReview({
      corrections: [fb, { original: 'x' }],
      phrases: [{ en: 'Here you are.', ko: '여기 있어요' }, { ko: 'no english' }],
      summary_ko: '잘했어요',
    });
    expect(r).toEqual({
      corrections: [fb],
      phrases: [{ en: 'Here you are.', ko: '여기 있어요' }],
      summary_ko: '잘했어요',
    });
  });

  it('throws bad_response when arrays are missing', () => {
    expect(() => parseSessionReview({ summary_ko: 'x' })).toThrowError(AiError);
  });
});

describe('schemas', () => {
  it('requires feedback before reply in the per-sentence schema', () => {
    expect(replyWithFeedbackSchema.required).toEqual(['feedback', 'reply']);
    expect(replyWithFeedbackSchema.propertyOrdering).toEqual(['feedback', 'reply']);
  });

  it('lists all categories in the review schema enum', () => {
    expect(reviewSchema.properties.corrections.items.properties.category.enum).toHaveLength(8);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/ai/schema.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ai/errors"`

- [ ] **Step 3: 오류 타입 구현**

`src/ai/errors.ts`:
```ts
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
```

- [ ] **Step 4: 스키마와 파서 구현**

`src/ai/schema.ts`:
```ts
import { CATEGORIES, type Category, type Correction, type SessionReview, type TurnResult } from '../types';
import { AiError } from './errors';

const correctionSchema = {
  type: 'OBJECT',
  properties: {
    original: { type: 'STRING' },
    better: { type: 'STRING' },
    point_ko: { type: 'STRING' },
    category: { type: 'STRING', enum: [...CATEGORIES] },
    ok: { type: 'BOOLEAN' },
  },
  required: ['original', 'better', 'point_ko', 'category', 'ok'],
  propertyOrdering: ['original', 'better', 'point_ko', 'category', 'ok'],
};

export const replySchema = {
  type: 'OBJECT',
  properties: { reply: { type: 'STRING' } },
  required: ['reply'],
};

export const replyWithFeedbackSchema = {
  type: 'OBJECT',
  properties: { feedback: correctionSchema, reply: { type: 'STRING' } },
  required: ['feedback', 'reply'],
  propertyOrdering: ['feedback', 'reply'],
};

export const reviewSchema = {
  type: 'OBJECT',
  properties: {
    corrections: { type: 'ARRAY', items: correctionSchema },
    phrases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { en: { type: 'STRING' }, ko: { type: 'STRING' } },
        required: ['en', 'ko'],
      },
    },
    summary_ko: { type: 'STRING' },
  },
  required: ['corrections', 'phrases', 'summary_ko'],
  propertyOrdering: ['corrections', 'phrases', 'summary_ko'],
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function asObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AiError('bad_response', 'response is not an object');
  }
  return raw as Record<string, unknown>;
}

export function parseJsonText(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiError('bad_response', 'invalid JSON');
  }
}

export function parseCorrection(raw: unknown): Correction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const original = str(o.original);
  const better = str(o.better);
  if (!original || !better) return null;
  const category: Category = (CATEGORIES as readonly string[]).includes(o.category as string)
    ? (o.category as Category)
    : 'expression';
  return { original, better, point_ko: str(o.point_ko), category, ok: typeof o.ok === 'boolean' ? o.ok : true };
}

export function parseTurnResult(raw: unknown, withFeedback: boolean): TurnResult {
  const o = asObject(raw);
  const reply = str(o.reply);
  if (!reply) throw new AiError('bad_response', 'missing reply');
  if (!withFeedback) return { reply };
  const feedback = parseCorrection(o.feedback);
  return feedback ? { reply, feedback } : { reply };
}

export function parseSessionReview(raw: unknown): SessionReview {
  const o = asObject(raw);
  if (!Array.isArray(o.corrections) || !Array.isArray(o.phrases)) {
    throw new AiError('bad_response', 'missing corrections or phrases');
  }
  return {
    corrections: o.corrections.map((c) => parseCorrection(c)).filter((c): c is Correction => c !== null),
    phrases: o.phrases.flatMap((p) => {
      const q = (p ?? {}) as Record<string, unknown>;
      const en = str(q.en);
      return en ? [{ en, ko: str(q.ko) }] : [];
    }),
    summary_ko: str(o.summary_ko),
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (`tests/ai/schema.test.ts` 12 tests 포함 전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/ai tests/ai
git commit -m "feat: add Gemini response schemas, parsers and AiError

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 상황 목록과 프롬프트

**Files:**
- Create: `src/scenarios/scenarios.ts`, `src/ai/prompt.ts`
- Test: `tests/scenarios/scenarios.test.ts`, `tests/ai/prompt.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `Mode`, `FocusItem`, `Turn` (Task 1)
- Produces:
  - `SCENARIOS: Scenario[]` (6개: immigration, hotel, cafe, restaurant, ride, smalltalk)
  - `makeCustomScenario(text: string): Scenario | null` — 공백이면 null, id는 `'custom'`
  - `START_CUE: string` — 대화 시작용 첫 user 메시지
  - `buildSystemPrompt(scenario: Scenario, mode: Mode, focus: FocusItem[]): string`
  - `buildReviewPrompt(): string`
  - `formatTranscript(turns: Turn[]): string` — `ME: ...` / `PARTNER: ...` 줄

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scenarios/scenarios.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeCustomScenario, SCENARIOS } from '../../src/scenarios/scenarios';

describe('scenarios', () => {
  it('has six preset scenarios with unique ids', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(['immigration', 'hotel', 'cafe', 'restaurant', 'ride', 'smalltalk']);
  });

  it('builds a custom scenario from user text', () => {
    const s = makeCustomScenario('  렌터카 빌리기 ');
    expect(s).toMatchObject({ id: 'custom', title_ko: '렌터카 빌리기' });
    expect(s?.setting_en).toContain('렌터카 빌리기');
  });

  it('returns null for blank custom text', () => {
    expect(makeCustomScenario('   ')).toBeNull();
  });
});
```

`tests/ai/prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildReviewPrompt, buildSystemPrompt, formatTranscript } from '../../src/ai/prompt';
import { SCENARIOS } from '../../src/scenarios/scenarios';

const cafe = SCENARIOS.find((s) => s.id === 'cafe')!;

describe('buildSystemPrompt', () => {
  it('includes the role, level and one-question rule', () => {
    const p = buildSystemPrompt(cafe, 'after', []);
    expect(p).toContain(cafe.role_en);
    expect(p).toContain('A2');
    expect(p).toContain('one question at a time');
  });

  it('tells the model to ignore speech-recognition punctuation', () => {
    expect(buildSystemPrompt(cafe, 'each', [])).toContain('speech recognition');
  });

  it('asks for feedback only in each mode', () => {
    expect(buildSystemPrompt(cafe, 'each', [])).toContain('"feedback"');
    expect(buildSystemPrompt(cafe, 'after', [])).not.toContain('"feedback"');
  });

  it('adds focus mistakes when given', () => {
    const p = buildSystemPrompt(cafe, 'after', [
      { category: 'missing_verb', count: 3, examples: [{ original: 'i first time', better: "it's my first time" }] },
    ]);
    expect(p).toContain('missing_verb');
    expect(p).toContain('"i first time" -> "it\'s my first time"');
  });

  it('omits the focus section when there are no mistakes', () => {
    expect(buildSystemPrompt(cafe, 'after', [])).not.toContain('often makes these mistakes');
  });
});

describe('buildReviewPrompt', () => {
  it('explains ME/PARTNER lines and Korean fields', () => {
    const p = buildReviewPrompt();
    expect(p).toContain('ME:');
    expect(p).toContain('PARTNER:');
    expect(p).toContain('summary_ko');
  });
});

describe('formatTranscript', () => {
  it('labels learner and partner lines', () => {
    expect(formatTranscript([
      { role: 'ai', text: 'Hi there!' },
      { role: 'user', text: 'cold brew please' },
    ])).toBe('PARTNER: Hi there!\nME: cold brew please');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/scenarios tests/ai/prompt.test.ts`
Expected: FAIL — `Failed to resolve import`

- [ ] **Step 3: 상황 목록 구현**

`src/scenarios/scenarios.ts`:
```ts
import type { Scenario } from '../types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'immigration', emoji: '🛂', title_ko: '공항 입국심사',
    role_en: 'a U.S. immigration officer at San Francisco International Airport',
    setting_en: 'The traveler has just arrived to attend the NVIDIA GTC conference. Ask typical entry questions one at a time: purpose of visit, length of stay, where they are staying, their job, and items to declare.',
  },
  {
    id: 'hotel', emoji: '🏨', title_ko: '호텔 체크인',
    role_en: 'a front desk clerk at a hotel in San Jose',
    setting_en: 'The guest is checking in for a 10-night stay. Handle the reservation name, ID, a credit card hold for incidentals, the room number and breakfast information.',
  },
  {
    id: 'cafe', emoji: '☕', title_ko: '카페 주문',
    role_en: 'a barista at a busy American coffee shop',
    setting_en: 'Take the order: drink, size, milk or sweetener, for here or to go, a name for the cup, payment, and the tip screen.',
  },
  {
    id: 'restaurant', emoji: '🍽️', title_ko: '식당',
    role_en: 'a server at a casual American restaurant',
    setting_en: 'Seat the guest, take drink and food orders, check on the meal, and handle the check and tip.',
  },
  {
    id: 'ride', emoji: '🚗', title_ko: '우버·길 묻기',
    role_en: 'an Uber driver in San Jose',
    setting_en: 'Pick up the rider, confirm their name and destination (the convention center or their hotel), and make light conversation during the ride.',
  },
  {
    id: 'smalltalk', emoji: '🎤', title_ko: '행사장 스몰토크',
    role_en: 'Mike, an American engineer attending NVIDIA GTC',
    setting_en: 'You meet the user in the coffee line after a keynote. Make small talk about the keynote, why they came, their work, and exchanging contacts.',
  },
];

export function makeCustomScenario(text: string): Scenario | null {
  const t = text.trim();
  if (!t) return null;
  return {
    id: 'custom', emoji: '✏️', title_ko: t,
    role_en: 'the most natural conversation partner for this situation',
    setting_en: `The learner described the situation (possibly in Korean): "${t}". Play the other person in it.`,
  };
}
```

- [ ] **Step 4: 프롬프트 구현**

`src/ai/prompt.ts`:
```ts
import type { FocusItem, Mode, Scenario, Turn } from '../types';

export const START_CUE = '(Start the role-play now. Say your first line only.)';

const SPEECH_NOTE =
  'Learner messages come from speech recognition, so ignore capitalization, punctuation and spelling. Focus on grammar, word choice and natural expressions.';

const CATEGORY_GUIDE =
  'category is one of: missing_verb (missing be-verb or main verb), tense, article (a/an/the), word_choice, word_order, expression (idioms, phrasal verbs, set phrases), adj_adv (adjective vs adverb, -ed vs -ing), culture (nuance, politeness, cultural fit).';

const FEEDBACK_FIELDS = [
  '- original: the learner sentence exactly as given.',
  '- better: the most natural way a native speaker would say it. If it is already natural, copy it unchanged.',
  '- point_ko: one or two short sentences in Korean explaining the key point. Praise what was good. Add a culture or nuance tip only when it really matters.',
  `- ${CATEGORY_GUIDE}`,
  '- ok: true if the meaning was understandable.',
];

export function buildSystemPrompt(scenario: Scenario, mode: Mode, focus: FocusItem[]): string {
  const lines = [
    'You are a friendly English conversation partner for a Korean engineer (CEFR A2 level) preparing for a business trip to the NVIDIA GTC conference in the USA.',
    `Role-play: you are ${scenario.role_en}. Situation: ${scenario.setting_en}`,
    'Stay in character. Speak natural everyday American English, but keep each reply short: 1-2 sentences, simple words, one question at a time.',
    'If the learner seems lost, rephrase more simply. Never use Korean in "reply".',
    `The first user message "${START_CUE}" is only a cue to begin; never correct it.`,
    SPEECH_NOTE,
  ];
  if (mode === 'each') {
    lines.push('For every learner message, fill "feedback" about that message:', ...FEEDBACK_FIELDS);
  } else {
    lines.push('Do not correct the learner during the conversation. Just keep talking naturally.');
  }
  if (focus.length > 0) {
    lines.push('The learner often makes these mistakes. Naturally ask questions that give chances to practice them, without mentioning this list:');
    for (const f of focus) {
      lines.push(`- ${f.category}: ${f.examples.map((e) => `"${e.original}" -> "${e.better}"`).join('; ')}`);
    }
  }
  return lines.join('\n');
}

export function buildReviewPrompt(): string {
  return [
    'You are an English tutor for a Korean engineer (CEFR A2 level). Review the conversation transcript the user sends.',
    'Lines starting with "ME:" are the learner. Lines starting with "PARTNER:" are the conversation partner; never correct those.',
    SPEECH_NOTE,
    'corrections: one item per learner line that has a grammar, word choice or expression problem. Skip lines that are already natural. Fields:',
    ...FEEDBACK_FIELDS,
    'phrases: 3-6 useful English expressions from this conversation worth memorizing, with the Korean meaning in "ko".',
    'summary_ko: 2-3 Korean sentences about what went well and the one thing to focus on next.',
  ].join('\n');
}

export function formatTranscript(turns: Turn[]): string {
  return turns.map((t) => `${t.role === 'user' ? 'ME' : 'PARTNER'}: ${t.text}`).join('\n');
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (scenarios 3 + prompt 7 포함 전체 통과)

- [ ] **Step 6: 커밋**

```bash
git add src/scenarios src/ai/prompt.ts tests/scenarios tests/ai/prompt.test.ts
git commit -m "feat: add scenarios and system/review prompts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Gemini 클라이언트

**Files:**
- Create: `src/ai/model.ts`, `src/ai/gemini.ts`
- Test: `tests/ai/gemini.test.ts`

**Interfaces:**
- Consumes: `AiError` (Task 3), `replySchema`, `replyWithFeedbackSchema`, `reviewSchema`, `parseJsonText`, `parseTurnResult`, `parseSessionReview` (Task 3), `START_CUE` (Task 4), `Turn`, `TurnResult`, `SessionReview` (Task 1)
- Produces:
  - `interface ChatModel { turn(system: string, history: Turn[], withFeedback: boolean): Promise<TurnResult>; review(system: string, transcript: string): Promise<SessionReview> }`
  - `interface GeminiOptions { apiKey: string; model: string; fetchFn?: typeof fetch; sleep?: (ms: number) => Promise<void>; retryDelayMs?: number }`
  - `class GeminiChatModel implements ChatModel` — `new GeminiChatModel(opts)`
  - 재시도 규칙: `rate_limit`, `unavailable`, `bad_response`는 1회 재시도(총 2번 시도), 나머지는 즉시 throw. 키가 비어 있으면 fetch 없이 `no_key`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ai/gemini.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../../src/ai/errors';
import { GeminiChatModel } from '../../src/ai/gemini';
import { START_CUE } from '../../src/ai/prompt';

const okBody = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

const errBody = (status: number, message = 'error') =>
  new Response(JSON.stringify({ error: { code: status, message } }), { status });

function setup(...responses: (Response | Error)[]) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const model = new GeminiChatModel({
    apiKey: 'test-key', model: 'gemini-2.5-flash',
    fetchFn: fetchFn as unknown as typeof fetch, sleep: async () => {},
  });
  return { model, fetchFn };
}

async function kindOf(p: Promise<unknown>) {
  try { await p; return 'resolved'; } catch (e) { return e instanceof AiError ? e.kind : 'other'; }
}

describe('GeminiChatModel.turn', () => {
  it('posts system prompt, start cue and mapped history with the reply schema', async () => {
    const { model, fetchFn } = setup(okBody({ reply: 'Hi there!' }));
    const res = await model.turn('SYS', [{ role: 'ai', text: 'Hello' }, { role: 'user', text: 'hi' }], false);
    expect(res).toEqual({ reply: 'Hi there!' });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: START_CUE }] },
      { role: 'model', parts: [{ text: 'Hello' }] },
      { role: 'user', parts: [{ text: 'hi' }] },
    ]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.required).toEqual(['reply']);
  });

  it('uses the feedback schema and returns feedback when requested', async () => {
    const feedback = { original: 'hear', better: 'here', point_ko: '철자', category: 'word_choice', ok: true };
    const { model, fetchFn } = setup(okBody({ feedback, reply: 'Got it.' }));
    const res = await model.turn('SYS', [{ role: 'ai', text: 'For here?' }, { role: 'user', text: 'hear' }], true);
    expect(res).toEqual({ reply: 'Got it.', feedback });
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseSchema.required).toEqual(['feedback', 'reply']);
  });

  it('uses the reply-only schema for the opener even in feedback mode', async () => {
    const { model, fetchFn } = setup(okBody({ reply: 'Next, please!' }));
    await model.turn('SYS', [], true);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseSchema.required).toEqual(['reply']);
  });

  it('throws no_key without calling fetch when the key is blank', async () => {
    const fetchFn = vi.fn();
    const model = new GeminiChatModel({ apiKey: '  ', model: 'm', fetchFn: fetchFn as unknown as typeof fetch });
    expect(await kindOf(model.turn('SYS', [], false))).toBe('no_key');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('retries once on 503', async () => {
    const { model, fetchFn } = setup(errBody(503, 'high demand'), okBody({ reply: 'Back!' }));
    expect(await model.turn('SYS', [], false)).toEqual({ reply: 'Back!' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('throws unavailable after two 503s', async () => {
    const { model, fetchFn } = setup(errBody(503), errBody(503));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('unavailable');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries once on 429 then reports rate_limit', async () => {
    const { model } = setup(errBody(429), errBody(429));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('rate_limit');
  });

  it('maps an invalid key to bad_key without retrying', async () => {
    const { model, fetchFn } = setup(errBody(400, 'API key not valid. Please pass a valid API key.'));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('bad_key');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('maps a thrown fetch to network without retrying', async () => {
    const { model, fetchFn } = setup(new TypeError('Failed to fetch'));
    expect(await kindOf(model.turn('SYS', [], false))).toBe('network');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries once when the JSON is broken', async () => {
    const broken = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"reply":' }] } }] }), { status: 200 });
    const { model } = setup(broken, okBody({ reply: 'Fixed' }));
    expect(await model.turn('SYS', [], false)).toEqual({ reply: 'Fixed' });
  });
});

describe('GeminiChatModel.review', () => {
  it('sends the transcript and parses the review', async () => {
    const review = { corrections: [], phrases: [{ en: 'Here you are.', ko: '여기 있어요' }], summary_ko: '좋아요' };
    const { model, fetchFn } = setup(okBody(review));
    expect(await model.review('REVIEW', 'ME: hi')).toEqual(review);
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'ME: hi' }] }]);
    expect(body.generationConfig.responseSchema.required).toEqual(['corrections', 'phrases', 'summary_ko']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/ai/gemini.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ai/gemini"`

- [ ] **Step 3: 인터페이스와 클라이언트 구현**

`src/ai/model.ts`:
```ts
import type { SessionReview, Turn, TurnResult } from '../types';

export interface ChatModel {
  turn(system: string, history: Turn[], withFeedback: boolean): Promise<TurnResult>;
  review(system: string, transcript: string): Promise<SessionReview>;
}
```

`src/ai/gemini.ts`:
```ts
import type { SessionReview, Turn, TurnResult } from '../types';
import { AiError, type AiErrorKind } from './errors';
import type { ChatModel } from './model';
import { START_CUE } from './prompt';
import {
  parseJsonText, parseSessionReview, parseTurnResult, replySchema, replyWithFeedbackSchema, reviewSchema,
} from './schema';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE = new Set<AiErrorKind>(['rate_limit', 'unavailable', 'bad_response']);

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retryDelayMs?: number;
}

function kindForStatus(status: number, body: string): AiErrorKind {
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'unavailable';
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) return 'bad_key';
  return 'bad_response';
}

export class GeminiChatModel implements ChatModel {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retryDelayMs: number;

  constructor(private readonly opts: GeminiOptions) {
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.retryDelayMs = opts.retryDelayMs ?? 1500;
  }

  turn(system: string, history: Turn[], withFeedback: boolean): Promise<TurnResult> {
    const feedback = withFeedback && history.length > 0;
    const contents: Content[] = [
      { role: 'user', parts: [{ text: START_CUE }] },
      ...history.map((t): Content => ({ role: t.role === 'ai' ? 'model' : 'user', parts: [{ text: t.text }] })),
    ];
    return this.generate(system, contents, feedback ? replyWithFeedbackSchema : replySchema, (v) =>
      parseTurnResult(v, feedback),
    );
  }

  review(system: string, transcript: string): Promise<SessionReview> {
    return this.generate(system, [{ role: 'user', parts: [{ text: transcript }] }], reviewSchema, parseSessionReview);
  }

  private async generate<T>(system: string, contents: Content[], schema: object, parse: (v: unknown) => T): Promise<T> {
    if (!this.opts.apiKey.trim()) throw new AiError('no_key');
    let last: AiError | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await this.sleep(this.retryDelayMs);
      try {
        return parse(parseJsonText(await this.call(system, contents, schema)));
      } catch (e) {
        if (e instanceof AiError && RETRYABLE.has(e.kind)) {
          last = e;
          continue;
        }
        throw e;
      }
    }
    throw last!;
  }

  private async call(system: string, contents: Content[], schema: object): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(`${BASE}/${encodeURIComponent(this.opts.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.opts.apiKey.trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 },
        }),
      });
    } catch {
      throw new AiError('network');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiError(kindForStatus(res.status, body), `HTTP ${res.status}`);
    }
    const data = (await res.json().catch(() => null)) as
      | { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      | null;
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new AiError('bad_response', 'empty candidate');
    return text;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (gemini 11 tests 포함 전체 통과)

- [ ] **Step 5: 실제 API 연결 확인 (수동, 키는 셸 변수로만)**

실제 키는 파일에 쓰지 않는다. 키는 실행할 때 프롬프트로 입력받고, 실행 후 스크립트를 지운다(커밋하지 않는다).

```bash
cat > smoke.ts <<'EOF'
import { GeminiChatModel } from './src/ai/gemini';
import { buildSystemPrompt } from './src/ai/prompt';
import { SCENARIOS } from './src/scenarios/scenarios';
const m = new GeminiChatModel({ apiKey: process.env.GEMINI_KEY ?? '', model: 'gemini-2.5-flash' });
const sys = buildSystemPrompt(SCENARIOS[2], 'each', []);
const opener = await m.turn(sys, [], true);
console.log(opener);
console.log(await m.turn(sys, [{ role: 'ai', text: opener.reply }, { role: 'user', text: 'is it restarant closely' }], true));
EOF
read -rsp 'Gemini key: ' GEMINI_KEY; echo; GEMINI_KEY="$GEMINI_KEY" npx tsx smoke.ts; rm -f smoke.ts
```
Expected: 첫 줄 `{ reply: '...' }`(바리스타 인사), 둘째 줄 `{ reply: '...', feedback: { original: 'is it restarant closely', better: ..., point_ko: '...한국어...', category: ..., ok: ... } }`. `npx tsx`가 없으면 설치 여부를 묻는데, 승인하면 된다(일회성 실행이고 package.json에는 추가하지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add src/ai/model.ts src/ai/gemini.ts tests/ai/gemini.test.ts
git commit -m "feat: add Gemini chat model with retry and error mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 음성 입출력 모듈

**Files:**
- Create: `src/speech/types.ts`, `src/speech/webSpeech.ts`
- Test: `tests/speech/webSpeech.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type SpeechErrorKind = 'unsupported' | 'permission' | 'failed'`, `class SpeechError extends Error { readonly kind: SpeechErrorKind }`
  - `interface SpeechInput { readonly supported: boolean; start(): void; stop(): Promise<string> }` — `start()`는 미지원이면 `SpeechError('unsupported')`, `stop()`은 인식된 전체 문장(없으면 `''`), 권한 거부면 `SpeechError('permission')`
  - `interface VoiceInfo { name: string; voiceURI: string; lang: string }`
  - `interface SpeechOutput { readonly supported: boolean; speak(text: string, opts: { rate: number; voiceURI: string | null }): Promise<void>; cancel(): void; voices(): VoiceInfo[]; onVoicesChanged(cb: () => void): () => void }`
  - `class WebSpeechInput implements SpeechInput` — `new WebSpeechInput(ctor?)`
  - `class WebSpeechOutput implements SpeechOutput` — `new WebSpeechOutput(synth?)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/speech/webSpeech.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SpeechError } from '../../src/speech/types';
import { WebSpeechInput, WebSpeechOutput } from '../../src/speech/webSpeech';

type Handler<T> = ((e: T) => void) | null;

class FakeRec {
  static last: FakeRec;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: Handler<{ results: ArrayLike<ArrayLike<{ transcript: string }>> }> = null;
  onerror: Handler<{ error: string }> = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() { FakeRec.last = this; }
  start() { this.started = true; }
  stop() { this.onend?.(); }
  emit(...texts: string[]) { this.onresult?.({ results: texts.map((t) => [{ transcript: t }]) }); }
  fail(error: string) { this.onerror?.({ error }); }
}

describe('WebSpeechInput', () => {
  it('reports unsupported when no recognition constructor exists', () => {
    const input = new WebSpeechInput(null);
    expect(input.supported).toBe(false);
    expect(() => input.start()).toThrowError(SpeechError);
  });

  it('configures English continuous recognition', () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    expect(FakeRec.last).toMatchObject({ lang: 'en-US', continuous: true, interimResults: true, started: true });
  });

  it('returns the full latest transcript on stop', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.emit('cold');
    FakeRec.last.emit('cold brew', ' please ');
    expect(await input.stop()).toBe('cold brew please');
  });

  it('returns empty string on no-speech', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.fail('no-speech');
    expect(await input.stop()).toBe('');
  });

  it('throws permission when the microphone is blocked', async () => {
    const input = new WebSpeechInput(FakeRec);
    input.start();
    FakeRec.last.fail('not-allowed');
    await expect(input.stop()).rejects.toMatchObject({ kind: 'permission' });
  });

  it('returns empty string when stop is called without start', async () => {
    expect(await new WebSpeechInput(FakeRec).stop()).toBe('');
  });
});

describe('WebSpeechOutput', () => {
  it('lists only English voices', () => {
    const synth = {
      getVoices: () => [
        { name: 'Samantha', voiceURI: 'sam', lang: 'en-US' },
        { name: 'Yuna', voiceURI: 'yuna', lang: 'ko-KR' },
      ],
    } as unknown as SpeechSynthesis;
    expect(new WebSpeechOutput(synth).voices()).toEqual([{ name: 'Samantha', voiceURI: 'sam', lang: 'en-US' }]);
  });

  it('is unsupported and silent without speechSynthesis', async () => {
    const out = new WebSpeechOutput(null);
    expect(out.supported).toBe(false);
    await expect(out.speak('hi', { rate: 1, voiceURI: null })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/speech`
Expected: FAIL — `Failed to resolve import "../../src/speech/types"`

- [ ] **Step 3: 인터페이스 구현**

`src/speech/types.ts`:
```ts
export type SpeechErrorKind = 'unsupported' | 'permission' | 'failed';

export class SpeechError extends Error {
  constructor(readonly kind: SpeechErrorKind, message: string = kind) {
    super(message);
    this.name = 'SpeechError';
  }
}

export interface SpeechInput {
  readonly supported: boolean;
  start(): void;
  stop(): Promise<string>;
}

export interface VoiceInfo {
  name: string;
  voiceURI: string;
  lang: string;
}

export interface SpeechOutput {
  readonly supported: boolean;
  speak(text: string, opts: { rate: number; voiceURI: string | null }): Promise<void>;
  cancel(): void;
  voices(): VoiceInfo[];
  onVoicesChanged(cb: () => void): () => void;
}
```

- [ ] **Step 4: Web Speech 구현**

`src/speech/webSpeech.ts`:
```ts
import { SpeechError, type SpeechInput, type SpeechOutput, type VoiceInfo } from './types';

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WebSpeechInput implements SpeechInput {
  private rec: RecognitionLike | null = null;
  private text = '';
  private error: string | null = null;
  private ended: Promise<void> = Promise.resolve();

  constructor(private readonly Ctor: RecognitionCtor | null = getRecognitionCtor()) {}

  get supported(): boolean {
    return this.Ctor !== null;
  }

  start(): void {
    if (!this.Ctor) throw new SpeechError('unsupported');
    this.rec?.stop();
    const rec = new this.Ctor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    this.text = '';
    this.error = null;
    // results는 지금까지의 전체 목록이라 매번 처음부터 다시 이어 붙인다 (미확정 결과 포함).
    rec.onresult = (e) => {
      this.text = Array.from(e.results, (r) => r[0]?.transcript.trim() ?? '').filter(Boolean).join(' ');
    };
    rec.onerror = (e) => {
      this.error = e.error;
    };
    this.ended = new Promise((resolve) => {
      rec.onend = () => resolve();
    });
    this.rec = rec;
    rec.start();
  }

  async stop(): Promise<string> {
    const rec = this.rec;
    if (!rec) return '';
    rec.stop();
    await this.ended;
    this.rec = null;
    if (this.error === 'not-allowed' || this.error === 'service-not-allowed') throw new SpeechError('permission');
    if (this.error && this.error !== 'no-speech' && this.error !== 'aborted') throw new SpeechError('failed', this.error);
    return this.text;
  }
}

export class WebSpeechOutput implements SpeechOutput {
  constructor(private readonly synth: SpeechSynthesis | null = globalThis.speechSynthesis ?? null) {}

  get supported(): boolean {
    return this.synth !== null;
  }

  voices(): VoiceInfo[] {
    return (this.synth?.getVoices() ?? [])
      .filter((v) => v.lang.startsWith('en'))
      .map(({ name, voiceURI, lang }) => ({ name, voiceURI, lang }));
  }

  onVoicesChanged(cb: () => void): () => void {
    const synth = this.synth;
    if (!synth) return () => {};
    synth.addEventListener('voiceschanged', cb);
    return () => synth.removeEventListener('voiceschanged', cb);
  }

  speak(text: string, { rate, voiceURI }: { rate: number; voiceURI: string | null }): Promise<void> {
    const synth = this.synth;
    if (!synth) return Promise.resolve();
    synth.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      const voice = voiceURI ? synth.getVoices().find((v) => v.voiceURI === voiceURI) : undefined;
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }
}
```

`speak()`는 Node에 `SpeechSynthesisUtterance`가 없어서 단위 테스트하지 않는다. Task 11 실기기 체크리스트에서 확인한다.

- [ ] **Step 5: 테스트와 타입 검사 통과 확인**

Run: `npm test && npx tsc --noEmit`
Expected: PASS (speech 8 tests 포함), 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/speech tests/speech
git commit -m "feat: add Web Speech input/output behind swappable interfaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 대화 세션 컨트롤러

**Files:**
- Create: `src/chat/session.ts`
- Test: `tests/chat/session.test.ts`

**Interfaces:**
- Consumes: `ChatModel` (Task 5), `AiError` (Task 3), `buildReviewPrompt`, `formatTranscript` (Task 4), `Correction`, `Mode`, `SessionReview`, `Turn` (Task 1)
- Produces:
  - `interface ChatTurn extends Turn { feedback?: Correction; failed?: boolean }`
  - `type SessionStatus = 'idle' | 'waiting' | 'ready' | 'finishing' | 'done'`
  - `interface SessionState { turns: ChatTurn[]; status: SessionStatus; error: AiError | null }`
  - `interface SessionDeps { model: ChatModel; speak(text: string): void; saveMistakes(c: Correction[]): Promise<void>; saveSession(turns: Turn[]): Promise<void> }`
  - `class ChatSession` — `new ChatSession(mode, system, deps, onChange)`, `getState()`, `start()`, `send(text): Promise<boolean>`, `retry()`, `finish(): Promise<SessionReview | null>`
  - 규칙: 시작 실패 시 status `idle` + error(→ `retry()`가 `start()` 다시 실행). 전송 실패 시 마지막 user 턴 `failed: true`, status `ready` + error(→ `retry()`가 다시 보냄). 실패한 턴이 남아 있거나 `ready`가 아니면 `send()`는 false. `each` 모드는 턴마다 feedback을 저장, `after` 모드는 `finish()`에서 review.corrections를 저장.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/chat/session.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { AiError } from '../../src/ai/errors';
import type { ChatModel } from '../../src/ai/model';
import { ChatSession, type SessionState } from '../../src/chat/session';
import type { Correction, Mode, SessionReview, TurnResult } from '../../src/types';

const fb: Correction = { original: 'hear', better: 'For here, please.', point_ko: '철자', category: 'word_choice', ok: true };
const review: SessionReview = { corrections: [fb], phrases: [{ en: 'For here', ko: '매장에서' }], summary_ko: '좋아요' };

function setup(mode: Mode, turns: (TurnResult | Error)[], reviewResult: SessionReview | Error = review) {
  const model: ChatModel = {
    turn: vi.fn(async () => {
      const next = turns.shift();
      if (!next) throw new Error('no more turns');
      if (next instanceof Error) throw next;
      return next;
    }),
    review: vi.fn(async () => {
      if (reviewResult instanceof Error) throw reviewResult;
      return reviewResult;
    }),
  };
  const deps = {
    model,
    speak: vi.fn(),
    saveMistakes: vi.fn(async () => {}),
    saveSession: vi.fn(async () => {}),
  };
  const states: SessionState[] = [];
  const session = new ChatSession(mode, 'SYS', deps, (s) => states.push(s));
  return { session, model, deps, states };
}

describe('ChatSession', () => {
  it('starts with the AI opener and speaks it', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi! What can I get you?' }]);
    await session.start();
    expect(model.turn).toHaveBeenCalledWith('SYS', [], false);
    expect(session.getState()).toMatchObject({ status: 'ready', error: null, turns: [{ role: 'ai', text: 'Hi! What can I get you?' }] });
    expect(deps.speak).toHaveBeenCalledWith('Hi! What can I get you?');
  });

  it('ignores blank input', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }]);
    await session.start();
    expect(await session.send('   ')).toBe(false);
    expect(model.turn).toHaveBeenCalledTimes(1);
  });

  it('in each mode attaches feedback to the user turn and saves it', async () => {
    const { session, model, deps } = setup('each', [{ reply: 'For here or to go?' }, { reply: 'Great.', feedback: fb }]);
    await session.start();
    expect(await session.send(' hear ')).toBe(true);
    expect(model.turn).toHaveBeenLastCalledWith('SYS', [
      { role: 'ai', text: 'For here or to go?' },
      { role: 'user', text: 'hear' },
    ], true);
    expect(session.getState().turns).toEqual([
      { role: 'ai', text: 'For here or to go?' },
      { role: 'user', text: 'hear', feedback: fb },
      { role: 'ai', text: 'Great.' },
    ]);
    expect(deps.saveMistakes).toHaveBeenCalledWith([fb]);
    expect(deps.speak).toHaveBeenLastCalledWith('Great.');
  });

  it('in after mode does not request or save feedback per turn', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi' }, { reply: 'Sure.' }]);
    await session.start();
    await session.send('cold brew please');
    expect(model.turn).toHaveBeenLastCalledWith('SYS', expect.any(Array), false);
    expect(deps.saveMistakes).not.toHaveBeenCalled();
  });

  it('ignores a second send while waiting', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }, { reply: 'Ok' }]);
    await session.start();
    const first = session.send('one');
    expect(await session.send('two')).toBe(false);
    await first;
    expect(model.turn).toHaveBeenCalledTimes(2);
    expect(session.getState().turns.filter((t) => t.role === 'user').map((t) => t.text)).toEqual(['one']);
  });

  it('marks the user turn failed and retry resends it', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }, new AiError('unavailable'), { reply: 'Back!' }]);
    await session.start();
    await session.send('hello');
    expect(session.getState().turns.at(-1)).toEqual({ role: 'user', text: 'hello', failed: true });
    expect(session.getState().error?.kind).toBe('unavailable');
    expect(await session.send('another')).toBe(false);

    await session.retry();
    expect(model.turn).toHaveBeenCalledTimes(3);
    expect(session.getState()).toMatchObject({ status: 'ready', error: null });
    expect(session.getState().turns.map((t) => t.text)).toEqual(['Hi', 'hello', 'Back!']);
  });

  it('wraps unknown errors as bad_response', async () => {
    const { session } = setup('after', [{ reply: 'Hi' }, new Error('boom')]);
    await session.start();
    await session.send('hello');
    expect(session.getState().error?.kind).toBe('bad_response');
  });

  it('retry after a failed start runs start again', async () => {
    const { session, model } = setup('after', [new AiError('no_key'), { reply: 'Hi' }]);
    await session.start();
    expect(session.getState()).toMatchObject({ status: 'idle', turns: [] });
    expect(session.getState().error?.kind).toBe('no_key');
    await session.retry();
    expect(model.turn).toHaveBeenCalledTimes(2);
    expect(session.getState().status).toBe('ready');
  });

  it('finish in after mode reviews the transcript and saves corrections and session', async () => {
    const { session, model, deps } = setup('after', [{ reply: 'Hi' }, { reply: 'Sure.' }]);
    await session.start();
    await session.send('cold brew please');
    const result = await session.finish();
    expect(result).toEqual(review);
    expect(model.review).toHaveBeenCalledWith(expect.stringContaining('ME:'), 'PARTNER: Hi\nME: cold brew please\nPARTNER: Sure.');
    expect(deps.saveMistakes).toHaveBeenCalledWith(review.corrections);
    expect(deps.saveSession).toHaveBeenCalledWith([
      { role: 'ai', text: 'Hi' }, { role: 'user', text: 'cold brew please' }, { role: 'ai', text: 'Sure.' },
    ]);
    expect(session.getState().status).toBe('done');
  });

  it('finish in each mode does not save review corrections again', async () => {
    const { session, deps } = setup('each', [{ reply: 'Hi' }, { reply: 'Ok', feedback: fb }]);
    await session.start();
    await session.send('hear');
    await session.finish();
    expect(deps.saveMistakes).toHaveBeenCalledTimes(1);
  });

  it('finish without any user turn returns an empty review without calling the model', async () => {
    const { session, model } = setup('after', [{ reply: 'Hi' }]);
    await session.start();
    expect(await session.finish()).toEqual({ corrections: [], phrases: [], summary_ko: '대화한 내용이 없어요.' });
    expect(model.review).not.toHaveBeenCalled();
  });

  it('finish failure keeps the session usable', async () => {
    const { session } = setup('after', [{ reply: 'Hi' }, { reply: 'Ok' }], new AiError('rate_limit'));
    await session.start();
    await session.send('hello');
    expect(await session.finish()).toBeNull();
    expect(session.getState()).toMatchObject({ status: 'ready' });
    expect(session.getState().error?.kind).toBe('rate_limit');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/chat`
Expected: FAIL — `Failed to resolve import "../../src/chat/session"`

- [ ] **Step 3: 세션 구현**

`src/chat/session.ts`:
```ts
import { AiError } from '../ai/errors';
import type { ChatModel } from '../ai/model';
import { buildReviewPrompt, formatTranscript } from '../ai/prompt';
import type { Correction, Mode, SessionReview, Turn, TurnResult } from '../types';

export interface ChatTurn extends Turn {
  feedback?: Correction;
  failed?: boolean;
}

export type SessionStatus = 'idle' | 'waiting' | 'ready' | 'finishing' | 'done';

export interface SessionState {
  turns: ChatTurn[];
  status: SessionStatus;
  error: AiError | null;
}

export interface SessionDeps {
  model: ChatModel;
  speak(text: string): void;
  saveMistakes(corrections: Correction[]): Promise<void>;
  saveSession(turns: Turn[]): Promise<void>;
}

const toAiError = (e: unknown): AiError => (e instanceof AiError ? e : new AiError('bad_response', String(e)));

export class ChatSession {
  private state: SessionState = { turns: [], status: 'idle', error: null };

  constructor(
    private readonly mode: Mode,
    private readonly system: string,
    private readonly deps: SessionDeps,
    private readonly onChange: (s: SessionState) => void,
  ) {}

  getState(): SessionState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state.status !== 'idle') return;
    this.update({ status: 'waiting', error: null });
    let res: TurnResult;
    try {
      res = await this.deps.model.turn(this.system, [], false);
    } catch (e) {
      this.update({ status: 'idle', error: toAiError(e) });
      return;
    }
    this.update({ turns: [{ role: 'ai', text: res.reply }], status: 'ready' });
    this.deps.speak(res.reply);
  }

  async send(text: string): Promise<boolean> {
    const t = text.trim();
    if (!t || this.state.status !== 'ready' || this.state.turns.at(-1)?.failed) return false;
    this.update({ turns: [...this.state.turns, { role: 'user', text: t }] });
    await this.request();
    return true;
  }

  async retry(): Promise<void> {
    if (!this.state.error) return;
    if (this.state.status === 'idle') return this.start();
    const last = this.state.turns.at(-1);
    if (this.state.status === 'ready' && last?.failed) {
      this.update({ turns: [...this.state.turns.slice(0, -1), { role: 'user', text: last.text }] });
      await this.request();
    }
  }

  async finish(): Promise<SessionReview | null> {
    if (this.state.status !== 'ready') return null;
    const history = this.history();
    if (!history.some((t) => t.role === 'user')) {
      this.update({ status: 'done' });
      return { corrections: [], phrases: [], summary_ko: '대화한 내용이 없어요.' };
    }
    this.update({ status: 'finishing', error: null });
    let review: SessionReview;
    try {
      review = await this.deps.model.review(buildReviewPrompt(), formatTranscript(history));
    } catch (e) {
      this.update({ status: 'ready', error: toAiError(e) });
      return null;
    }
    this.update({ status: 'done' });
    if (this.mode === 'after') await this.deps.saveMistakes(review.corrections);
    await this.deps.saveSession(history);
    return review;
  }

  private async request(): Promise<void> {
    this.update({ status: 'waiting', error: null });
    const withFeedback = this.mode === 'each';
    let res: TurnResult;
    try {
      res = await this.deps.model.turn(this.system, this.history(), withFeedback);
    } catch (e) {
      const turns = [...this.state.turns];
      turns[turns.length - 1] = { ...turns[turns.length - 1], failed: true };
      this.update({ turns, status: 'ready', error: toAiError(e) });
      return;
    }
    const turns = [...this.state.turns];
    if (withFeedback && res.feedback) turns[turns.length - 1] = { ...turns[turns.length - 1], feedback: res.feedback };
    this.update({ turns: [...turns, { role: 'ai', text: res.reply }], status: 'ready' });
    if (withFeedback && res.feedback) await this.deps.saveMistakes([res.feedback]);
    this.deps.speak(res.reply);
  }

  private history(): Turn[] {
    return this.state.turns.filter((t) => !t.failed).map(({ role, text }) => ({ role, text }));
  }

  private update(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS (session 12 tests 포함 전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/chat tests/chat
git commit -m "feat: add ChatSession controller for both practice modes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 앱 화면 틀, 홈, 설정

**Files:**
- Create: `src/ui/styles.css`, `src/ui/App.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/SettingsScreen.tsx`
- Modify: `src/main.tsx` (전체 교체)

**Interfaces:**
- Consumes: `SCENARIOS`, `makeCustomScenario` (Task 4), `loadSettings`, `saveSettings` (Task 2), `WebSpeechOutput`, `SpeechOutput`, `VoiceInfo` (Task 6), `Mode`, `Scenario`, `Settings`, `SessionReview` (Task 1)
- Produces:
  - `type Screen = { name: 'home' } | { name: 'settings' } | { name: 'notes' } | { name: 'chat'; scenario: Scenario; mode: Mode } | { name: 'review'; review: SessionReview }` (`src/ui/App.tsx`에서 export)
  - `HomeScreen({ hasKey, onStart(scenario, mode), onNotes(), onSettings() })`
  - `SettingsScreen({ settings, output, onSave(settings), onBack() })`
  - CSS 클래스: `screen`, `bar`, `primary`, `list`, `seg`, `on`, `composer`, `chat`, `bubble user|ai`, `card`, `tag`, `orig`, `better`, `point`, `mic`, `error`, `muted`, `row`

이 Task부터는 UI라 자동 테스트 대신 `npm run build`와 브라우저 수동 확인으로 검증한다(스펙 7절: UI는 실기기 체크리스트).

- [ ] **Step 1: 스타일 작성**

`src/ui/styles.css`:
```css
:root {
  --bg: #ffffff; --fg: #1b1f24; --muted: #6b7280; --card: #f3f4f6;
  --accent: #1f6feb; --warn: #b45309; --user: #dbeafe; --ai: #f3f4f6; --rec: #dc2626;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #0d1117; --fg: #e6edf3; --muted: #9ca3af; --card: #161b22; --warn: #f59e0b; --user: #1e3a5f; --ai: #161b22; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, 'Noto Sans KR', sans-serif; font-size: 17px; line-height: 1.5; }
.screen { max-width: 640px; margin: 0 auto; padding: 16px; min-height: 100dvh; display: flex; flex-direction: column; gap: 12px; }
.bar { display: flex; align-items: center; gap: 8px; }
.bar h1 { font-size: 20px; margin: 0; flex: 1; }
button { font: inherit; border: 0; border-radius: 10px; padding: 10px 14px; background: var(--card); color: var(--fg); cursor: pointer; }
button.primary { background: var(--accent); color: #fff; }
button:disabled { opacity: 0.5; cursor: default; }
input, select { font: inherit; width: 100%; padding: 10px; border-radius: 10px; border: 1px solid var(--muted); background: var(--bg); color: var(--fg); }
label { display: grid; gap: 4px; }
.list { display: grid; gap: 8px; }
.list button { text-align: left; padding: 14px; }
.seg { display: flex; gap: 8px; }
.seg button { flex: 1; }
.seg button.on { background: var(--accent); color: #fff; }
.composer, .row { display: flex; gap: 8px; align-items: center; }
.composer input { flex: 1; }
.chat { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.bubble { max-width: 85%; padding: 10px 12px; border-radius: 14px; white-space: pre-wrap; }
.bubble.user { align-self: flex-end; background: var(--user); }
.bubble.ai { align-self: flex-start; background: var(--ai); }
.card { background: var(--card); border-radius: 12px; padding: 12px; display: grid; gap: 4px; }
.tag { font-size: 14px; color: var(--muted); }
.orig { color: var(--muted); text-decoration: line-through; }
.better { font-weight: 600; }
.mic { width: 100%; padding: 22px; font-size: 20px; background: var(--accent); color: #fff; touch-action: none; user-select: none; -webkit-user-select: none; }
.mic.on { background: var(--rec); }
.error { color: var(--warn); }
.muted { color: var(--muted); font-size: 14px; }
table { width: 100%; border-collapse: collapse; }
td { padding: 6px 4px; border-bottom: 1px solid var(--card); vertical-align: top; }
```

- [ ] **Step 2: 홈 화면 작성**

`src/ui/HomeScreen.tsx`:
```tsx
import { useState } from 'preact/hooks';
import { makeCustomScenario, SCENARIOS } from '../scenarios/scenarios';
import type { Mode, Scenario } from '../types';

interface Props {
  hasKey: boolean;
  onStart: (scenario: Scenario, mode: Mode) => void;
  onNotes: () => void;
  onSettings: () => void;
}

export function HomeScreen({ hasKey, onStart, onNotes, onSettings }: Props) {
  const [mode, setMode] = useState<Mode>('after');
  const [custom, setCustom] = useState('');

  return (
    <div class="screen">
      <header class="bar">
        <h1>Speak Coach</h1>
        <button onClick={onNotes}>📒 노트</button>
        <button onClick={onSettings} aria-label="설정">⚙️</button>
      </header>
      {!hasKey && <p class="error">먼저 ⚙️ 설정에서 Gemini API 키를 입력해 주세요.</p>}
      <div class="seg">
        <button class={mode === 'after' ? 'on' : ''} onClick={() => setMode('after')}>대화 후 교정</button>
        <button class={mode === 'each' ? 'on' : ''} onClick={() => setMode('each')}>문장마다 교정</button>
      </div>
      <div class="list">
        {SCENARIOS.map((s) => (
          <button key={s.id} disabled={!hasKey} onClick={() => onStart(s, mode)}>
            {s.emoji} {s.title_ko}
          </button>
        ))}
      </div>
      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const scenario = makeCustomScenario(custom);
          if (scenario) onStart(scenario, mode);
        }}
      >
        <input value={custom} onInput={(e) => setCustom(e.currentTarget.value)} placeholder="직접 상황 입력 (예: 렌터카 빌리기)" />
        <button class="primary" disabled={!hasKey || !custom.trim()}>시작</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 설정 화면 작성**

`src/ui/SettingsScreen.tsx`:
```tsx
import { useEffect, useState } from 'preact/hooks';
import type { SpeechOutput, VoiceInfo } from '../speech/types';
import { DEFAULT_SETTINGS, type Settings } from '../types';

interface Props {
  settings: Settings;
  output: SpeechOutput;
  onSave: (s: Settings) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, output, onSave, onBack }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [voices, setVoices] = useState<VoiceInfo[]>(() => output.voices());

  useEffect(() => output.onVoicesChanged(() => setVoices(output.voices())), [output]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onBack} aria-label="뒤로">←</button>
        <h1>설정</h1>
      </header>
      <label>
        Gemini API 키
        <input type="password" autocomplete="off" value={draft.apiKey} onInput={(e) => set('apiKey', e.currentTarget.value.trim())} />
        <span class="muted">Google AI Studio에서 무료로 발급받을 수 있어요. 키는 이 폰에만 저장돼요.</span>
      </label>
      <label>
        모델
        <input value={draft.model} onInput={(e) => set('model', e.currentTarget.value.trim() || DEFAULT_SETTINGS.model)} />
        <span class="muted">기본값 {DEFAULT_SETTINGS.model}. 서버가 계속 혼잡하면 다른 Flash 모델로 바꿔 보세요.</span>
      </label>
      <label>
        말하기 속도: {draft.rate.toFixed(1)}
        <input type="range" min="0.6" max="1.2" step="0.1" value={draft.rate} onInput={(e) => set('rate', Number(e.currentTarget.value))} />
      </label>
      <label>
        목소리
        <select value={draft.voiceURI ?? ''} onChange={(e) => set('voiceURI', e.currentTarget.value || null)}>
          <option value="">기본 영어 목소리</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>
      </label>
      <div class="row">
        <button onClick={() => output.speak('Hi, nice to meet you. Welcome to GTC!', { rate: draft.rate, voiceURI: draft.voiceURI })}>
          🔊 목소리 듣기
        </button>
        <button class="primary" onClick={() => onSave(draft)}>저장</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: App과 진입점 작성**

`src/ui/App.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'preact/hooks';
import { WebSpeechOutput } from '../speech/webSpeech';
import { loadSettings, saveSettings } from '../storage/db';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { HomeScreen } from './HomeScreen';
import { SettingsScreen } from './SettingsScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'notes' }
  | { name: 'chat'; scenario: Scenario; mode: Mode }
  | { name: 'review'; review: SessionReview };

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const output = useMemo(() => new WebSpeechOutput(), []);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;
  const home = () => setScreen({ name: 'home' });

  switch (screen.name) {
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          output={output}
          onBack={home}
          onSave={async (s) => {
            await saveSettings(s);
            setSettings(s);
            home();
          }}
        />
      );
    default:
      return (
        <HomeScreen
          hasKey={settings.apiKey.length > 0}
          onStart={(scenario, mode) => setScreen({ name: 'chat', scenario, mode })}
          onNotes={() => setScreen({ name: 'notes' })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
  }
}
```

`src/main.tsx` (전체 교체):
```tsx
import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);
```

- [ ] **Step 5: 빌드와 수동 확인**

Run: `npm test && npm run build`
Expected: 테스트 전체 PASS, 빌드 성공

Run: `npm run dev` 후 노트북 크롬에서 `http://localhost:5173/speak-coach/` 열기
Expected:
- 홈에 "먼저 ⚙️ 설정에서…" 경고, 상황 버튼 6개 비활성화
- ⚙️ → 키 입력(아무 문자열) → 저장 → 홈에서 경고 사라지고 버튼 활성화
- 새로고침해도 키가 유지됨(IndexedDB)
- 설정에서 🔊 목소리 듣기가 영어로 재생됨
- 상황 버튼이나 📒 노트를 누르면 아직 홈이 다시 보임(Task 9, 10에서 연결)

- [ ] **Step 6: 커밋**

```bash
git add src/main.tsx src/ui
git commit -m "feat: add app shell with home and settings screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 대화 화면

**Files:**
- Create: `src/ui/labels.ts`, `src/ui/CorrectionCard.tsx`, `src/ui/ChatScreen.tsx`
- Modify: `src/ui/App.tsx` (전체 교체)
- Test: `tests/ui/labels.test.ts`

**Interfaces:**
- Consumes: `ChatSession`, `SessionState` (Task 7), `GeminiChatModel` (Task 5), `AI_ERROR_KO` (Task 3), `buildSystemPrompt` (Task 4), `WebSpeechInput`, `SpeechError`, `SpeechOutput` (Task 6), `loadMistakes`, `addMistakes`, `saveSession` (Task 2), `buildFocus`, `toEntries`, `sameSentence` (Task 2), `Screen` (Task 8)
- Produces:
  - `CATEGORY_KO: Record<Category, string>`, `speechMessage(err: unknown): string` (`src/ui/labels.ts`)
  - `CorrectionCard({ c }: { c: Correction })`
  - `ChatScreen({ scenario, mode, settings, output, onDone(review), onExit() })`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/labels.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SpeechError } from '../../src/speech/types';
import { CATEGORY_KO, speechMessage } from '../../src/ui/labels';
import { CATEGORIES } from '../../src/types';

describe('labels', () => {
  it('has a Korean label for every category', () => {
    for (const c of CATEGORIES) expect(CATEGORY_KO[c]).toBeTruthy();
  });

  it('explains microphone permission in Korean', () => {
    expect(speechMessage(new SpeechError('permission'))).toContain('마이크 권한');
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(speechMessage(new Error('x'))).toContain('음성 인식');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run tests/ui`
Expected: FAIL — `Failed to resolve import "../../src/ui/labels"`

- [ ] **Step 3: 라벨 구현**

`src/ui/labels.ts`:
```ts
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
```

- [ ] **Step 4: 라벨 테스트 통과 확인**

Run: `npx vitest run tests/ui`
Expected: PASS (3 tests)

- [ ] **Step 5: 교정 카드 작성**

`src/ui/CorrectionCard.tsx`:
```tsx
import { sameSentence } from '../storage/mistakes';
import type { Correction } from '../types';
import { CATEGORY_KO } from './labels';

export function CorrectionCard({ c }: { c: Correction }) {
  const perfect = sameSentence(c.original, c.better);
  return (
    <div class="card">
      <div class="tag">
        {perfect ? '✅ 완벽해요' : c.ok ? '✅ 뜻은 통해요' : '⚠️ 다시 보기'}
        {!perfect && ` · ${CATEGORY_KO[c.category]}`}
      </div>
      {!perfect && <div class="orig">{c.original}</div>}
      <div class="better">{perfect ? c.better : `→ ${c.better}`}</div>
      {c.point_ko && <div>{c.point_ko}</div>}
    </div>
  );
}
```

- [ ] **Step 6: 대화 화면 작성**

`src/ui/ChatScreen.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AI_ERROR_KO } from '../ai/errors';
import { GeminiChatModel } from '../ai/gemini';
import { buildSystemPrompt } from '../ai/prompt';
import { ChatSession, type SessionState } from '../chat/session';
import { SpeechError, type SpeechOutput } from '../speech/types';
import { WebSpeechInput } from '../speech/webSpeech';
import { addMistakes, loadMistakes, saveSession } from '../storage/db';
import { buildFocus, toEntries } from '../storage/mistakes';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { CorrectionCard } from './CorrectionCard';
import { speechMessage } from './labels';

interface Props {
  scenario: Scenario;
  mode: Mode;
  settings: Settings;
  output: SpeechOutput;
  onDone: (review: SessionReview) => void;
  onExit: () => void;
}

export function ChatScreen({ scenario, mode, settings, output, onDone, onExit }: Props) {
  const input = useMemo(() => new WebSpeechInput(), []);
  const sessionRef = useRef<ChatSession | null>(null);
  const recordingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SessionState>({ turns: [], status: 'idle', error: null });
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState(input.supported ? '' : speechMessage(new SpeechError('unsupported')));
  const [text, setText] = useState('');
  const voice = { rate: settings.rate, voiceURI: settings.voiceURI };

  useEffect(() => {
    let alive = true;
    (async () => {
      const focus = buildFocus(await loadMistakes());
      const session = new ChatSession(
        mode,
        buildSystemPrompt(scenario, mode, focus),
        {
          model: new GeminiChatModel({ apiKey: settings.apiKey, model: settings.model }),
          speak: (t) => void output.speak(t, voice),
          saveMistakes: (c) => addMistakes(toEntries(c, scenario.id)),
          saveSession: (turns) => saveSession({ at: Date.now(), scenarioId: scenario.id, mode, turns }),
        },
        (s) => alive && setState(s),
      );
      sessionRef.current = session;
      await session.start();
    })();
    return () => {
      alive = false;
      output.cancel();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.turns.length, state.status]);

  const send = async (said: string) => {
    if (await sessionRef.current?.send(said)) setText('');
  };

  const micDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    output.cancel();
    setHint('');
    try {
      input.start();
      recordingRef.current = true;
      setRecording(true);
    } catch (err) {
      setHint(speechMessage(err));
    }
  };

  const micUp = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    try {
      const said = await input.stop();
      if (!said) {
        setHint('잘 안 들렸어요. 다시 말해 주세요.');
        return;
      }
      await send(said);
    } catch (err) {
      setHint(speechMessage(err));
    }
  };

  const finish = async () => {
    output.cancel();
    const review = await sessionRef.current?.finish();
    if (review) onDone(review);
  };

  const { turns, status, error } = state;
  const lastFailed = turns.at(-1)?.failed === true;
  const busy = status === 'waiting' || status === 'finishing';
  const canTalk = status === 'ready' && !lastFailed;

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onExit} aria-label="나가기">←</button>
        <h1>{scenario.emoji} {scenario.title_ko}</h1>
        <button class="primary" onClick={finish} disabled={status !== 'ready'}>끝내기</button>
      </header>

      <div class="chat" ref={listRef}>
        {turns.map((t, i) =>
          t.role === 'ai' ? (
            <div key={i} class="bubble ai">
              {t.text}{' '}
              <button onClick={() => output.speak(t.text, voice)} aria-label="다시 듣기">🔊</button>
            </div>
          ) : (
            <div key={i} style={{ display: 'contents' }}>
              <div class="bubble user">{t.text}{t.failed && ' ⚠️'}</div>
              {t.feedback && <CorrectionCard c={t.feedback} />}
            </div>
          ),
        )}
        {status === 'waiting' && <div class="bubble ai">…</div>}
        {status === 'finishing' && <div class="muted">교정 결과를 만드는 중이에요…</div>}
      </div>

      {error && (
        <div class="row">
          <span class="error">{AI_ERROR_KO[error.kind]}</span>
          {(status === 'idle' || lastFailed) && (
            <button onClick={() => sessionRef.current?.retry()}>다시 보내기</button>
          )}
        </div>
      )}
      {hint && <div class="error">{hint}</div>}

      {input.supported && (
        <button
          class={recording ? 'mic on' : 'mic'}
          disabled={!canTalk}
          onPointerDown={micDown}
          onPointerUp={micUp}
          onPointerCancel={micUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {recording ? '🔴 듣는 중… 떼면 전송' : busy ? '…' : '🎤 누르고 말하기'}
        </button>
      )}
      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="또는 여기에 입력" disabled={!canTalk} />
        <button class="primary" disabled={!canTalk || !text.trim()}>보내기</button>
      </form>
    </div>
  );
}
```

음성 인식 미지원 브라우저에서는 🎤 버튼을 숨기고 "이 브라우저는 음성 인식을 지원하지 않아요" 안내를 처음부터 보여 준다.

- [ ] **Step 7: App에 대화 화면 연결**

`src/ui/App.tsx` (전체 교체):
```tsx
import { useEffect, useMemo, useState } from 'preact/hooks';
import { WebSpeechOutput } from '../speech/webSpeech';
import { loadSettings, saveSettings } from '../storage/db';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { ChatScreen } from './ChatScreen';
import { HomeScreen } from './HomeScreen';
import { SettingsScreen } from './SettingsScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'notes' }
  | { name: 'chat'; scenario: Scenario; mode: Mode }
  | { name: 'review'; review: SessionReview };

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const output = useMemo(() => new WebSpeechOutput(), []);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;
  const home = () => setScreen({ name: 'home' });

  switch (screen.name) {
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          output={output}
          onBack={home}
          onSave={async (s) => {
            await saveSettings(s);
            setSettings(s);
            home();
          }}
        />
      );
    case 'chat':
      return (
        <ChatScreen
          scenario={screen.scenario}
          mode={screen.mode}
          settings={settings}
          output={output}
          onExit={home}
          onDone={(review) => setScreen({ name: 'review', review })}
        />
      );
    default:
      return (
        <HomeScreen
          hasKey={settings.apiKey.length > 0}
          onStart={(scenario, mode) => setScreen({ name: 'chat', scenario, mode })}
          onNotes={() => setScreen({ name: 'notes' })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
  }
}
```

- [ ] **Step 8: 빌드와 수동 확인 (노트북 크롬, 실제 키)**

Run: `npm test && npm run build && npm run dev`
노트북 크롬 `http://localhost:5173/speak-coach/` → ⚙️에 실제 Gemini 키 입력 → 저장
Expected:
- ☕ 카페 주문(대화 후 교정): AI 첫 인사가 말풍선과 음성으로 나옴
- 🎤를 누른 채 "cold brew please"라고 말하고 떼면 → 내 말풍선 → AI 답변이 음성으로 나옴
- 🎤를 아주 짧게 누르면 → "잘 안 들렸어요" 안내
- 텍스트 칸에 "hear" 입력 후 보내기 → 동작
- 문장마다 교정 모드로 시작해서 "is it restarant closely" 입력 → 내 말풍선 아래 교정 카드(취소선 원문, → 고친 문장, 한국어 설명)
- 설정에서 키를 `wrong`으로 바꾸고 시작 → "API 키가 올바르지 않아요" + 다시 보내기
- "끝내기"를 누르면 아직 홈으로 돌아감(Task 10에서 교정 결과 화면 연결)

- [ ] **Step 9: 커밋**

```bash
git add src/ui tests/ui
git commit -m "feat: add chat screen with push-to-talk and per-sentence feedback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 교정 결과 화면과 실수 노트

**Files:**
- Create: `src/ui/ReviewScreen.tsx`, `src/ui/NotesScreen.tsx`
- Modify: `src/ui/App.tsx` (전체 교체)

**Interfaces:**
- Consumes: `CorrectionCard`, `CATEGORY_KO` (Task 9), `loadMistakes` (Task 2), `buildFocus` (Task 2), `SessionReview`, `MistakeEntry` (Task 1), `Screen` (Task 8)
- Produces:
  - `ReviewScreen({ review, onHome(), onNotes() })`
  - `NotesScreen({ onBack() })`

- [ ] **Step 1: 교정 결과 화면 작성**

`src/ui/ReviewScreen.tsx`:
```tsx
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
```

- [ ] **Step 2: 실수 노트 화면 작성**

`src/ui/NotesScreen.tsx`:
```tsx
import { useEffect, useState } from 'preact/hooks';
import { loadMistakes } from '../storage/db';
import { buildFocus } from '../storage/mistakes';
import type { MistakeEntry } from '../types';
import { CorrectionCard } from './CorrectionCard';
import { CATEGORY_KO } from './labels';

const SHOW_LIMIT = 100;

export function NotesScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<MistakeEntry[] | null>(null);

  useEffect(() => {
    loadMistakes().then(setEntries);
  }, []);

  if (!entries) return null;
  const focus = buildFocus(entries);

  return (
    <div class="screen">
      <header class="bar">
        <button onClick={onBack} aria-label="뒤로">←</button>
        <h1>📒 실수 노트</h1>
      </header>

      {entries.length === 0 && <p class="muted">아직 저장된 교정이 없어요. 대화를 끝내면 여기에 모여요.</p>}

      {focus.length > 0 && (
        <div class="card">
          <b>자주 틀리는 유형 TOP {focus.length}</b>
          {focus.map((f, i) => (
            <div key={f.category}>
              {i + 1}. {CATEGORY_KO[f.category]} — {f.count}번
            </div>
          ))}
          <span class="muted">다음 대화에서 AI가 이 유형을 연습할 기회를 만들어 줘요.</span>
        </div>
      )}

      {entries.slice(0, SHOW_LIMIT).map((e) => (
        <div key={e.id}>
          <div class="muted">{new Date(e.at).toLocaleDateString('ko-KR')}</div>
          <CorrectionCard c={e} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: App에 두 화면 연결**

`src/ui/App.tsx` (전체 교체):
```tsx
import { useEffect, useMemo, useState } from 'preact/hooks';
import { WebSpeechOutput } from '../speech/webSpeech';
import { loadSettings, saveSettings } from '../storage/db';
import type { Mode, Scenario, SessionReview, Settings } from '../types';
import { ChatScreen } from './ChatScreen';
import { HomeScreen } from './HomeScreen';
import { NotesScreen } from './NotesScreen';
import { ReviewScreen } from './ReviewScreen';
import { SettingsScreen } from './SettingsScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'notes' }
  | { name: 'chat'; scenario: Scenario; mode: Mode }
  | { name: 'review'; review: SessionReview };

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const output = useMemo(() => new WebSpeechOutput(), []);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  if (!settings) return null;
  const home = () => setScreen({ name: 'home' });
  const notes = () => setScreen({ name: 'notes' });

  switch (screen.name) {
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          output={output}
          onBack={home}
          onSave={async (s) => {
            await saveSettings(s);
            setSettings(s);
            home();
          }}
        />
      );
    case 'chat':
      return (
        <ChatScreen
          scenario={screen.scenario}
          mode={screen.mode}
          settings={settings}
          output={output}
          onExit={home}
          onDone={(review) => setScreen({ name: 'review', review })}
        />
      );
    case 'review':
      return <ReviewScreen review={screen.review} onHome={home} onNotes={notes} />;
    case 'notes':
      return <NotesScreen onBack={home} />;
    default:
      return (
        <HomeScreen
          hasKey={settings.apiKey.length > 0}
          onStart={(scenario, mode) => setScreen({ name: 'chat', scenario, mode })}
          onNotes={notes}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      );
  }
}
```

- [ ] **Step 4: 빌드와 수동 확인 (노트북 크롬, 실제 키)**

Run: `npm test && npm run build && npm run dev`
Expected:
- 🛂 입국심사(대화 후 교정)에서 "yes i first time", "i am ai engineer"를 입력하고 끝내기 → 총평 카드, 교정 카드 2개 이상, "오늘 배운 표현" 표
- 📒 실수 노트 → TOP 유형 목록과 방금 저장된 교정 카드(날짜 표시)
- 다시 아무 상황이나 시작하면 정상 동작(실수 노트가 프롬프트에 들어가도 깨지지 않음)
- 대화 없이 바로 끝내기 → "대화한 내용이 없어요." 화면

- [ ] **Step 5: 커밋**

```bash
git add src/ui
git commit -m "feat: add review and mistake notes screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: PWA 설치, GitHub Pages 배포, 실기기 확인

**Files:**
- Create: `public/icon.svg`, `public/pwa-*.png`·`maskable-icon-512x512.png`·`apple-touch-icon-180x180.png`·`favicon.ico` (생성됨), `.github/workflows/deploy.yml`
- Modify: `vite.config.ts` (전체 교체), `tsconfig.json` (`types`에 `vite-plugin-pwa/client` 추가), `index.html` (아이콘 링크 추가)

**Interfaces:**
- Consumes: 완성된 앱 (Task 1~10)
- Produces: `https://daegyu93.github.io/speak-coach/` 배포, 홈 화면 설치 가능한 PWA

- [ ] **Step 1: PWA 의존성 설치와 아이콘 생성**

```bash
npm i -D vite-plugin-pwa @vite-pwa/assets-generator
mkdir -p public
cat > public/icon.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1f6feb"/>
  <path d="M136 136h240a40 40 0 0 1 40 40v128a40 40 0 0 1-40 40H248l-88 64v-64h-24a40 40 0 0 1-40-40V176a40 40 0 0 1 40-40z" fill="#ffffff"/>
  <circle cx="196" cy="240" r="22" fill="#1f6feb"/>
  <circle cx="256" cy="240" r="22" fill="#1f6feb"/>
  <circle cx="316" cy="240" r="22" fill="#1f6feb"/>
</svg>
EOF
npx pwa-assets-generator --preset minimal-2023 public/icon.svg
ls public
```
Expected: `public/`에 `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`, `icon.svg`

- [ ] **Step 2: PWA 설정**

`vite.config.ts` (전체 교체):
```ts
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/speak-coach/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Speak Coach',
        short_name: 'Speak Coach',
        description: 'AI 영어 회화 연습',
        lang: 'ko',
        theme_color: '#1f6feb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/speak-coach/',
        scope: '/speak-coach/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});
```

`tsconfig.json`의 `"types": ["vite/client"]`를 아래로 바꾼다:
```json
    "types": ["vite/client", "vite-plugin-pwa/client"]
```

`index.html`의 `<title>` 줄 바로 아래에 추가한다:
```html
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 3: 빌드 확인**

Run: `npm test && npm run build && ls dist`
Expected: 테스트 전체 PASS, `dist/`에 `manifest.webmanifest`, `sw.js`, 아이콘 파일

- [ ] **Step 4: 배포 워크플로 작성**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: 커밋, Pages 활성화, 배포**

```bash
git add public vite.config.ts tsconfig.json index.html package.json package-lock.json .github
git commit -m "feat: make the app an installable PWA and deploy to GitHub Pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
gh api -X POST repos/daegyu93/speak-coach/pages -f build_type=workflow
git push
gh run watch --exit-status $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: Pages 활성화 응답(이미 켜져 있으면 409, 무시), 워크플로 성공.
Run: `curl -sI https://daegyu93.github.io/speak-coach/ | head -1`
Expected: `HTTP/2 200`

- [ ] **Step 6: 안드로이드 실기기 체크리스트 (사용자와 함께)**

폰 크롬에서 `https://daegyu93.github.io/speak-coach/`를 열고 하나씩 확인한다. 결과를 사용자에게 받아서 기록한다.

- [ ] ⚙️ 설정에 Gemini 키 입력·저장, 🔊 목소리 듣기가 영어로 재생됨
- [ ] 크롬 메뉴 → "홈 화면에 추가"(또는 "앱 설치") → 홈 화면 아이콘으로 실행하면 주소창 없이 열림
- [ ] 처음 🎤를 누르면 마이크 권한 요청 → 허용 후 인식됨
- [ ] 중간에 잠깐 쉬면서 긴 문장을 말해도 전체 문장이 한 번만 들어감(안드로이드 중복 인식 여부 확인)
- [ ] 짧게 누르면 "잘 안 들렸어요"
- [ ] AI 답변이 자동 재생되고, 🎤를 누르면 재생이 멈춤
- [ ] "대화 후 교정"으로 1회 완주 → 교정 결과 화면
- [ ] "문장마다 교정"으로 1회 완주 → 문장마다 교정 카드
- [ ] 📒 실수 노트에 TOP 유형과 교정이 쌓임
- [ ] 비행기 모드에서 보내기 → "인터넷 연결을 확인…" + 다시 보내기 → 연결 후 성공

실패한 항목은 superpowers:systematic-debugging으로 원인을 찾고, 고친 뒤 테스트 → 커밋 → 푸시(자동 재배포)한다.

- [ ] **Step 7: 키 교체 안내**

사용자에게 안내한다: 채팅에 붙여 넣었던 키는 AI Studio에서 삭제하고, 새 키를 발급받아 폰 설정 화면에만 입력할 것.
