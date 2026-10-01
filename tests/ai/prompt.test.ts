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
