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
