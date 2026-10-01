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
