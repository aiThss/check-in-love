import './styles/main.css';
import { initRouter } from './router';

/* ─── Apply saved theme before first paint to avoid flash ───────────────────── */
(function applyTheme() {
  const saved = localStorage.getItem('admin_theme');

  if (saved === 'dark' || saved === 'light') {
    document.documentElement.dataset['theme'] = saved;
    return;
  }

  // Respect OS preference if no explicit setting
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.dataset['theme'] = 'dark';
  } else {
    document.documentElement.dataset['theme'] = 'light';
  }
})();

/* ─── Bootstrap ──────────────────────────────────────────────────────────────── */
initRouter();
