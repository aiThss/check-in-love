import { renderOnboardingPage } from './onboarding';
import { navigate } from '../router';
import { clearPrivateClientState } from '../session';

/**
 * Google accounts finish setup on a standalone page. Keeping this route
 * separate from the email/OTP registration entry point prevents the two
 * flows from sharing account-registration controls.
 */
export function renderGoogleOnboardingPage(): HTMLElement {
  const page = renderOnboardingPage({ mode: 'google' });

  const isDevHost = window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
    || window.location.hostname.startsWith('192.168.');
  if (isDevHost) {
    const testAgainButton = document.createElement('button');
    testAgainButton.type = 'button';
    testAgainButton.className = 'btn-ghost';
    testAgainButton.textContent = '🧪 Test lại Google Dev';
    testAgainButton.setAttribute('aria-label', 'Quay lại để test Google Dev');
    testAgainButton.style.cssText = [
      'position:fixed',
      'top:calc(var(--safe-top) + 12px)',
      'left:16px',
      'z-index:5',
      'padding:8px 12px',
      'font-size:11px',
      'border:1px dashed var(--accent)',
      'color:var(--accent)',
      'background:var(--surface)',
    ].join(';');
    testAgainButton.addEventListener('click', () => {
      clearPrivateClientState();
      [
        'google_authenticated_user',
        'dev_onboarding_step',
        'dev_onboarding_displayName',
        'dev_onboarding_partnerName',
        'dev_onboarding_coupleCode',
        'dev_onboarding_loveStartDate',
        'dev_onboarding_email',
        'dev_onboarding_useAccount',
      ].forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.setItem('dev_login_tab', 'google');
      navigate('/login?tab=google', true);
    });
    page.appendChild(testAgainButton);
  }

  return page;
}
