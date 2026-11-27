// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '../api/auth';

let calculateAge: typeof import('./anniversary-cards').calculateAge;
let resolveOccasionCard: typeof import('./anniversary-cards').resolveOccasionCard;
let needsBirthdaySetup: typeof import('./anniversary-cards').needsBirthdaySetup;

beforeAll(async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  ({ calculateAge, resolveOccasionCard, needsBirthdaySetup } = await import('./anniversary-cards'));
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

  it('prioritizes the recipient own birthday over a fixed holiday', () => {
    const card = resolveOccasionCard(
      makeMe({
        user: {
          id: 'user-1',
          displayName: 'Em',
          partnerName: 'Anh',
          birthday: '2006-02-14T00:00:00.000Z',
        },
        couple: { loveStartDate: '2026-02-01T00:00:00.000Z' },
      } as Partial<MeResponse>),
      new Date('2027-02-14T03:00:00.000Z'),
    );
    expect(card?.id).toBe('birthday');
    expect(card?.title).toContain('21');
  });

  it('requires explicit sender toggle for gender-specific holidays like Vietnamese Women’s Day', () => {
    const withoutToggle = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-10-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-10-20T03:00:00.000Z'),
    );
    expect(withoutToggle).toBeNull();

    const withToggle = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-10-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-10-20T03:00:00.000Z'),
      [
        {
          id: 'card-2010',
          occasionKey: 'vietnamese-womens-day',
          kind: 'builtin',
          enabled: true,
          scheduleType: 'builtin',
          title: 'Chúc mừng 20/10 công chúa',
          updatedAt: '2026-10-18T00:00:00.000Z',
        },
      ],
    );
    expect(withToggle?.id).toBe('vietnamese-womens-day');
    expect(withToggle?.title).toBe('Chúc mừng 20/10 công chúa');
  });

  it('supports Vietnam Culture Day (24/11) and Lunar New Year (1/1 ÂL)', () => {
    const cultureCard = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-11-24T03:00:00.000Z'),
    );
    expect(cultureCard?.id).toBe('vietnam-culture-day');

    // 2026-02-17 is Mùng 1 Tết Bính Ngọ (1/1 Âm lịch)
    const tetCard = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-02-17T03:00:00.000Z'),
    );
    expect(tetCard?.id).toBe('lunar-new-year');
  });

  it('gives top priority to a custom-date surprise card authored by partner', () => {
    const customCard = resolveOccasionCard(
      makeMe({ couple: { loveStartDate: '2026-01-01T00:00:00.000Z' } } as Partial<MeResponse>),
      new Date('2026-05-20T03:00:00.000Z'),
      [
        {
          id: 'custom-520',
          occasionKey: 'custom-520',
          kind: 'custom',
          enabled: true,
          scheduleType: 'once',
          customDate: '2026-05-20',
          title: 'Ngày 520 nói yêu em',
          scratchCoverUrl: 'https://example.test/cover.jpg',
          backgroundImageUrl: 'https://example.test/bg.jpg',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      ],
    );
    expect(customCard?.id).toBe('custom-520');
    expect(customCard?.title).toBe('Ngày 520 nói yêu em');
    expect(customCard?.scratchCoverUrl).toBe('https://example.test/cover.jpg');
    expect(customCard?.backgroundImageUrl).toBe('https://example.test/bg.jpg');
  });
});

describe('calculateAge', () => {
  it('calculates the age from the birthday year', () => {
    expect(calculateAge('2006-05-04T00:00:00.000Z', { year: 2026, month: 7, day: 29 })).toBe(20);
  });
});

describe('needsBirthdaySetup', () => {
  it('asks for Birthday when either birthday is missing', () => {
    expect(needsBirthdaySetup(makeMe())).toBe(true);
    expect(needsBirthdaySetup(makeMe({ user: { birthday: '2000-05-04' } } as Partial<MeResponse>))).toBe(true);
    expect(needsBirthdaySetup(makeMe({ user: { partnerBirthday: '2001-06-05' } } as Partial<MeResponse>))).toBe(true);
  });

  it('does not ask when both birthdays are available', () => {
    expect(needsBirthdaySetup(makeMe({
      user: { birthday: '2000-05-04', partnerBirthday: '2001-06-05' },
    } as Partial<MeResponse>))).toBe(false);
  });
});
