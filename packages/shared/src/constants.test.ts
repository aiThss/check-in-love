import { describe, expect, it } from 'vitest';
import { MOOD_LABELS, QUICK_MESSAGES, RANDOM_PROMPTS, REACTION_LABELS } from './constants';

describe('shared check-in content', () => {
  it('exposes the moods and reactions used by the app', () => {
    expect(Object.keys(MOOD_LABELS)).toContain('happy');
    expect(Object.keys(REACTION_LABELS)).toContain('heart');
  });

  it('provides non-empty quick messages and prompts for every category', () => {
    expect(QUICK_MESSAGES.length).toBeGreaterThan(0);
    expect(Object.values(RANDOM_PROMPTS).every((prompts) => prompts.length > 0)).toBe(true);
  });
});
