// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '../api/auth';

let calculateAge: typeof import('./anniversary-cards').calculateAge;
let resolveOccasionCard: typeof import('./anniversary-cards').resolveOccasionCard;

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  ({ calculateAge, resolveOccasionCard } = await import('./anniversary-cards'));
});

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

  it('waits for midnight in Vietnam before showing the 100-day card', () => {
    const beforeMidnight = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-04-10T16:59:59.999Z'),
    );
    const atMidnight = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-04-10T17:00:00.000Z'),
    );

    expect(beforeMidnight?.id).not.toBe('day-100');
    expect(atMidnight?.id).toBe('day-100');
  });

  it('stops showing the 100-day card after the exact milestone date', () => {
    const card = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-04-11T17:00:00.000Z'),
    );

    expect(card?.id).not.toBe('day-100');
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
