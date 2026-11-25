import { triggerHaptic } from '../ui/haptics';
import { icon } from '../ui/icons/icons';
import { setUiTheme } from '../ui/theme/index';

/** A small light/dark switch for unauthenticated entry screens (Bespoke SVG, zero emojis). */
export function createThemeToggleButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-icon c-icon-btn auth-theme-toggle';

  const sync = (): void => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    button.replaceChildren(icon(isDark ? 'sun' : 'moon', { size: 20, variant: 'filled' }));
    button.setAttribute('aria-pressed', String(isDark));
    const nextLabel = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    button.setAttribute('aria-label', nextLabel);
    button.title = nextLabel;
  };

  button.addEventListener('click', () => {
    triggerHaptic('tap');
    const isDark = document.documentElement.dataset.theme === 'dark';
    setUiTheme(isDark ? 'light' : 'dark');
    sync();
  });

  sync();
  return button;
}
