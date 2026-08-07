import { store } from '../store/index';

/** A small light/dark switch for unauthenticated entry screens. */
export function createThemeToggleButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-icon auth-theme-toggle';

  const sync = (): void => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    button.textContent = isDark ? '☀️' : '🌙';
    button.setAttribute('aria-pressed', String(isDark));
    const nextLabel = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    button.setAttribute('aria-label', nextLabel);
    button.title = nextLabel;
  };

  button.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    store.set({ theme: isDark ? 'light' : 'dark' });
    sync();
  });

  sync();
  return button;
}
