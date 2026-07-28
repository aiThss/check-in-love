import { describe, expect, it } from 'vitest';
import type { MeResponse } from '../api/auth';
import { calculateAge, resolveOccasionCard } from './anniversary-cards';

function makeMe(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: 'user-1',
      displayName: 'Anh',
      partnerName: 'Em',
    },
    couple: {
      loveStartDate: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  } as MeResponse;
}

describe('resolveOccasionCard', () => {
  it('opens the 100-day card on the exact milestone', () => {
    const card = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-04-11T03:00:00.000Z'),
    );
    expect(card?.id).toBe('day-100');
  });

  it('opens an annual anniversary card on the same month and day', () => {
    const card = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2025-07-29T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-07-29T03:00:00.000Z'),
    );
    expect(card?.id).toBe('anniversary');
    expect(card?.title).toContain('1 năm');
  });

  it('prioritizes a birthday over a fixed holiday', () => {
    const card = resolveOccasionCard(
      makeMe({
        user: {
          id: 'user-1',
          displayName: 'Anh',
          partnerName: 'Em',
          partnerBirthday: '2006-02-14T00:00:00.000Z',
        },
        couple: { loveStartDate: '2026-02-01T00:00:00.000Z' },
      } as Partial<MeResponse>),
      new Date('2027-02-14T03:00:00.000Z'),
    );
    expect(card?.id).toBe('birthday');
    expect(card?.title).toContain('21');
  });

  it('supports Vietnamese Women’s Day', () => {
    const card = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-10-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-10-20T03:00:00.000Z'),
    );
    expect(card?.id).toBe('vietnamese-womens-day');
  });
});

describe('calculateAge', () => {
  it('calculates the age from the birthday year', () => {
    expect(calculateAge('2006-05-04T00:00:00.000Z', { year: 2026, month: 7, day: 29 })).toBe(20);
  });
});
