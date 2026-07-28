import { describe, expect, it } from 'vitest';
import { calculateCurrentStreak } from './streak';

const NOW = new Date('2026-07-28T08:00:00.000Z'); // 15:00 in Vietnam

describe('calculateCurrentStreak', () => {
  it('counts past six days without an artificial cap', () => {
    expect(
      calculateCurrentStreak(
        [
          '2026-07-28',
          '2026-07-27',
          '2026-07-26',
          '2026-07-25',
          '2026-07-24',
          '2026-07-23',
          '2026-07-22',
          '2026-07-21',
        ],
        NOW,
      ),
    ).toBe(8);
  });

  it('counts each calendar day once even with repeated check-ins', () => {
    expect(
      calculateCurrentStreak(
        ['2026-07-28', '2026-07-28', '2026-07-27', '2026-07-27'],
        NOW,
      ),
    ).toBe(2);
  });

  it('keeps yesterday as the active streak while today is still open', () => {
    expect(
      calculateCurrentStreak(
        ['2026-07-27', '2026-07-26', '2026-07-25'],
        NOW,
      ),
    ).toBe(3);
  });

  it('expires after a full calendar day is missed', () => {
    expect(
      calculateCurrentStreak(
        ['2026-07-26', '2026-07-25', '2026-07-24'],
        NOW,
      ),
    ).toBe(0);
  });
});
