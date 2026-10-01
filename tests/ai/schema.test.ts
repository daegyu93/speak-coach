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
