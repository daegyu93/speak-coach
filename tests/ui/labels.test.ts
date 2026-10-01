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
