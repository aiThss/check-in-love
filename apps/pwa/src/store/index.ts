import type { User, Couple } from '../api/types';

// ── State shape ───────────────────────────────────────────────────────────────

export interface AppState {
  token: string | null;
  user: User | null;
  couple: Couple | null;
  theme: 'light' | 'dark' | 'system';
  hasNewCheckin: boolean;
}

const STATE_KEY = 'lovecheck_state';
const TOKEN_KEY = 'lovecheck_token';

declare global {
  interface Window {
    LoveCheckAndroid?: {
      updateWidget?: (streak: number, partnerName: string) => void;
    };
  }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultState: AppState = {
  token: null,
  user: null,
  couple: null,
  theme: 'system',
  hasNewCheckin: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFromStorage(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...defaultState, ...parsed };
  } catch {
    return { ...defaultState };
  }
}

function writeToStorage(state: AppState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota exceeded
  }
}

function syncAndroidWidget(state: AppState): void {
  try {
    const bridge = window.LoveCheckAndroid;
    const streak = state.couple?.streak ?? 0;
    const partnerName = state.user?.partnerName ?? '';
    bridge?.updateWidget?.(streak, partnerName);
  } catch {
    // Android bridge is best-effort only.
  }
}

// ── Apply theme to document ───────────────────────────────────────────────────

export function applyTheme(theme: AppState['theme']): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const store = {
  get(): AppState {
    return readFromStorage();
  },

  set(partial: Partial<AppState>): void {
    const current = readFromStorage();
    const next = { ...current, ...partial };
    writeToStorage(next);
    syncAndroidWidget(next);

    // Keep token in sync with dedicated key for apiFetch
    if (partial.token !== undefined) {
      if (partial.token) {
        localStorage.setItem(TOKEN_KEY, partial.token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }

    // Apply theme if changed
    if (partial.theme !== undefined) {
      applyTheme(partial.theme);
    }
  },

  clear(): void {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    document.documentElement.removeAttribute('data-theme');
    syncAndroidWidget({ ...defaultState });
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    const current = readFromStorage();
    const next = { ...current, token };
    writeToStorage(next);
    syncAndroidWidget(next);
  },

  isAuthenticated(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token;
  },

  /** Initialize theme from stored state on app load */
  initTheme(): void {
    const state = readFromStorage();
    applyTheme(state.theme);
    syncAndroidWidget(state);

    // Listen for system preference changes when theme is "system"
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        const current = store.get();
        if (current.theme === 'system') {
          applyTheme('system');
        }
      });
  },
};
