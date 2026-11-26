// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../store/index';

const sendOtpMock = vi.fn().mockResolvedValue({ message: 'OK', expiresIn: 300 });
const verifyOtpMock = vi.fn().mockResolvedValue({ verified: true, message: 'OK' });
const startOnboardingMock = vi.fn().mockResolvedValue({
  token: 'jwt-real-token',
  user: {
    id: 'u1',
    displayName: 'Minh',
    partnerName: 'Linh',
    email: 'minh@example.com',
    coupleId: 'c1',
    role: 'user',
    status: 'active',
    reminderEnabled: false,
    reminderTime: '20:30',
    reminderTimezone: 'Asia/Ho_Chi_Minh',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  couple: {
    id: 'c1',
    code: 'LOVE26',
    loveStartDate: '2024-02-14',
    streak: 0,
    lastCheckinDate: null,
    memberIds: ['u1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
});
const loginWithGoogleMock = vi.fn();

vi.mock('../api/auth', () => ({
  sendOtp: (...args: unknown[]) => sendOtpMock(...args),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  startOnboarding: (...args: unknown[]) => startOnboardingMock(...args),
  loginWithGoogle: (...args: unknown[]) => loginWithGoogleMock(...args),
}));

import { renderOnboardingPage } from './onboarding';

describe('Onboarding — Mandatory Step 3 Auth & Animated Love Date Wheel', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
    store.set({ token: null, user: null, couple: null });
    sendOtpMock.mockClear();
    verifyOtpMock.mockClear();
    startOnboardingMock.mockClear();
    loginWithGoogleMock.mockReset();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true, // reduced motion in unit tests for deterministic assertions
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('requires Email+Password or Google OAuth in Step 3 with no skip toggle, and enforces OTP in Step 4', async () => {
    sessionStorage.setItem('dev_onboarding_step', '2');
    sessionStorage.setItem('dev_onboarding_displayName', 'Minh');
    sessionStorage.setItem('dev_onboarding_partnerName', 'Linh');
    sessionStorage.setItem('dev_onboarding_coupleCode', 'LOVE26');

    const root = renderOnboardingPage();
    document.body.appendChild(root);

    // No optional switch to bypass account registration
    expect(root.querySelector('[role="switch"]')).toBeNull();
    expect(root.querySelector('#onboarding-google-signin')).not.toBeNull();

    const emailInput = root.querySelector<HTMLInputElement>('input[type="email"]')!;
    const pwdInput = root.querySelector<HTMLInputElement>('input[type="password"]')!;
    expect(emailInput).not.toBeNull();
    expect(pwdInput).not.toBeNull();

    const findPrimaryBtn = () =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        b.textContent?.includes('Tiếp tục xác thực Email'),
      )!;

    // Cannot proceed with Couple Code alone when Email/Password are empty
    findPrimaryBtn().click();
    expect(sessionStorage.getItem('dev_onboarding_step')).toBe('2');

    // Fill valid Email & Password -> moves to Step 4 OTP
    emailInput.value = 'minh@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwdInput.value = 'secret123';
    pwdInput.dispatchEvent(new Event('input', { bubbles: true }));

    findPrimaryBtn().click();
    expect(sessionStorage.getItem('dev_onboarding_step')).toBe('3');
    expect(root.querySelector('.p-auth-title')?.textContent).toBe('Xác thực Email');
    // jsdom ch?y tr�n localhost => ch? d? demo: kh�ng g?i email th?t, d�ng PIN 123456
    expect(sendOtpMock).not.toHaveBeenCalled();
    expect(root.textContent).toContain('123456');

    // Step 4 OTP must NOT have any skip verification bypass button
    const buttonLabels = Array.from(root.querySelectorAll('button')).map((b) => b.textContent || '');
    expect(buttonLabels.some((t) => t.toLowerCase().includes('bỏ qua'))).toBe(false);

    // Enter 6-digit OTP and verify -> advances to Step 5 Love Start Date
    const otpCells = Array.from(root.querySelectorAll<HTMLInputElement>('.p-otp-cell'));
    expect(otpCells).toHaveLength(6);
    '123456'.split('').forEach((digit, idx) => {
      otpCells[idx].value = digit;
      otpCells[idx].dispatchEvent(new Event('input', { bubbles: true }));
    });

    const verifyBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Xác thực Email'),
    )!;
    verifyBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('dev_onboarding_step')).toBe('4');
    expect(root.querySelector('#wheel-day')).not.toBeNull();
  });

  it('allows signing in with Google directly in Step 3 and skips OTP to Date step when Couple Code is filled', async () => {
    loginWithGoogleMock.mockResolvedValue({
      token: 'google-jwt',
      user: {
        id: 'g1',
        displayName: 'Minh Google',
        partnerName: '',
        email: 'minh.google@gmail.com',
        googleId: 'gid-1',
        coupleId: null,
        role: 'user',
        status: 'active',
      },
      couple: null,
      isNewUser: true,
    });

    sessionStorage.setItem('dev_onboarding_step', '2');
    sessionStorage.setItem('dev_onboarding_displayName', 'Minh');
    sessionStorage.setItem('dev_onboarding_partnerName', 'Linh');
    sessionStorage.setItem('dev_onboarding_coupleCode', 'COUPLE8');

    const root = renderOnboardingPage();
    document.body.appendChild(root);

    const devGoogleBtn = root.querySelector<HTMLButtonElement>('[data-dev-google-login="true"]');
    expect(devGoogleBtn).not.toBeNull();
    devGoogleBtn!.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(loginWithGoogleMock).toHaveBeenCalled();
    expect(sessionStorage.getItem('google_authenticated_user')).toBe('true');
    // Couple code was already valid, so it jumps straight to Date Wheel step!
    expect(root.querySelector('#wheel-day')).not.toBeNull();
  });

  it('renders interactive 3-column animated date wheel where clicking any day/month/year or preset selects the date', () => {
    sessionStorage.setItem('google_authenticated_user', 'true');
    sessionStorage.setItem('dev_onboarding_step', '3');
    sessionStorage.setItem('dev_onboarding_displayName', 'Minh');
    sessionStorage.setItem('dev_onboarding_partnerName', 'Linh');
    sessionStorage.setItem('dev_onboarding_coupleCode', 'LOVE26');

    const root = renderOnboardingPage({ mode: 'google' });
    document.body.appendChild(root);

    const wheelDay = root.querySelector<HTMLElement>('#wheel-day')!;
    const wheelMonth = root.querySelector<HTMLElement>('#wheel-month')!;
    const wheelYear = root.querySelector<HTMLElement>('#wheel-year')!;

    expect(wheelDay.querySelectorAll('button')).toHaveLength(31);
    expect(wheelMonth.querySelectorAll('button')).toHaveLength(12);
    expect(wheelYear.querySelectorAll('button').length).toBeGreaterThanOrEqual(30);

    // Click arbitrary date: 14 / Tháng 2 / 2024
    const day14 = wheelDay.querySelector<HTMLButtonElement>('button[data-value="14"]')!;
    const month02 = wheelMonth.querySelector<HTMLButtonElement>('button[data-value="02"]')!;
    const year2024 = wheelYear.querySelector<HTMLButtonElement>('button[data-value="2024"]')!;

    year2024.click();
    month02.click();
    day14.click();

    expect(sessionStorage.getItem('dev_onboarding_loveStartDate')).toBe('2024-02-14');
    expect(day14.classList.contains('selected')).toBe(true);
    expect(month02.classList.contains('selected')).toBe(true);
    expect(year2024.classList.contains('selected')).toBe(true);
    expect(root.querySelector('.p-date-cal-emblem__month')?.textContent).toBe('THÁNG 2');
    expect(root.querySelector('.p-date-cal-emblem__day')?.textContent).toBe('14');

    // Clicking day 31 when month is Feb 2024 (leap year = 29 days) clamps safely to 29!
    wheelDay.querySelector<HTMLButtonElement>('button[data-value="31"]')!.click();
    expect(sessionStorage.getItem('dev_onboarding_loveStartDate')).toBe('2024-02-29');

    // Clicking "Hôm nay" preset updates counter to "0 ngày" and marks chip active
    const todayChip = Array.from(root.querySelectorAll<HTMLButtonElement>('.p-date-preset-chip')).find(
      (c) => c.dataset.days === '0',
    )!;
    todayChip.click();
    expect(todayChip.classList.contains('active')).toBe(true);
    expect(root.querySelector('.p-date-preview__count')?.textContent).toBe('0 ngày');
  });
});
