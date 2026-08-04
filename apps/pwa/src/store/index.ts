import type { Couple, User } from '../api/types';

export interface AppState {
  token: string | null;
  user: User | null;
  couple: Couple | null;
  theme: 'light' | 'dark' | 'system';
  hasNewCheckin: boolean;
}

export type StoreListener = (state: AppState, previousState: AppState) => void;

const STATE_KEY = 'lovecheck_state';
const TOKEN_KEY = 'lovecheck_token';

declare global {
  interface Window {
    LoveCheckAndroid?: {
      updateWidget?: (streak: number, partnerName: string) => void;
      getFcmToken?: () => string;
      signInWithGoogle?: () => void;
    };
    onFcmTokenReceived?: (token: string) => void;
  }
}

const defaultState: AppState = {
  token: null,
  user: null,
  couple: null,
  theme: 'system',
  hasNewCheckin: false,
};

function readFromStorage(): AppState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppState>) : {};
    // Preserve sessions written by older clients that only used STATE_KEY.
    const token = localStorage.getItem(TOKEN_KEY) ?? parsed.token ?? null;
    return { ...defaultState, ...parsed, token };
  } catch {
    return { ...defaultState };
  }
}

function writeToStorage(nextState: AppState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
  } catch {
    // Storage can be unavailable or full; the in-memory state remains usable.
  }
}

function syncAndroidWidget(nextState: AppState): void {
  try {
    window.LoveCheckAndroid?.updateWidget?.(
      nextState.couple?.streak ?? 0,
      nextState.user?.partnerName ?? '',
    );
  } catch {
    // Android bridge is best-effort only.
  }
}

function syncMountedStreakBadges(nextState: AppState): void {
  const streak = Math.max(0, Math.trunc(nextState.couple?.streak ?? 0));

  document.querySelectorAll<HTMLElement>('.streak-banner').forEach((badge) => {
    const suffix = badge.closest('.profile-page') ? ' ngày streak' : ' ngày';
    const text = `🔥 ${streak}${suffix}`;
    if (badge.textContent?.trim() !== text) badge.textContent = text;
  });
}

export function applyTheme(theme: AppState['theme']): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute(
    'data-theme',
    theme === 'dark' || (theme === 'system' && prefersDark) ? 'dark' : 'light',
  );
}

let state = readFromStorage();
const listeners = new Set<StoreListener>();
let themeListenerInstalled = false;
let storageListenerInstalled = false;

function publish(nextState: AppState, previousState: AppState): void {
  syncMountedStreakBadges(nextState);
  syncAndroidWidget(nextState);
  listeners.forEach((listener) => listener(nextState, previousState));
}

function commit(partial: Partial<AppState>, persist: boolean): void {
  const previousState = state;
  state = { ...state, ...partial };
  if (persist) writeToStorage(state);

  if (partial.token !== undefined) {
    if (partial.token) localStorage.setItem(TOKEN_KEY, partial.token);
    else localStorage.removeItem(TOKEN_KEY);
  }
  if (partial.theme !== undefined) applyTheme(state.theme);
  publish(state, previousState);
}

export const store = {
  get(): AppState {
    return state;
  },

  set(partial: Partial<AppState>): void {
    commit(partial, true);
  },

  clear(): void {
    const previousState = state;
    state = { ...defaultState };
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    document.documentElement.removeAttribute('data-theme');
    publish(state, previousState);
  },

  getToken(): string | null {
    return state.token;
  },

  setToken(token: string): void {
    commit({ token }, true);
  },

  isAuthenticated(): boolean {
    return Boolean(state.token);
  },

  subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  initTheme(): void {
    applyTheme(state.theme);
    syncAndroidWidget(state);

    if (!themeListenerInstalled) {
      themeListenerInstalled = true;
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.theme === 'system') applyTheme('system');
      });
    }

    if (!storageListenerInstalled) {
      storageListenerInstalled = true;
      window.addEventListener('storage', (event) => {
        if (event.key !== STATE_KEY && event.key !== TOKEN_KEY) return;
        const previousState = state;
        state = readFromStorage();
        applyTheme(state.theme);
        publish(state, previousState);
      });
    }
  },
};
