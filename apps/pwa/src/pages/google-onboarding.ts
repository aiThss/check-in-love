import { renderOnboardingPage } from './onboarding';

/**
 * Google accounts finish setup on a standalone page. Keeping this route
 * separate from the email/OTP registration entry point prevents the two
 * flows from sharing account-registration controls.
 */
export function renderGoogleOnboardingPage(): HTMLElement {
  return renderOnboardingPage({ mode: 'google' });
}
