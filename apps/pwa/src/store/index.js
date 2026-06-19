const STATE_KEY = 'lovecheck_state';
const TOKEN_KEY = 'lovecheck_token';
// ── Defaults ──────────────────────────────────────────────────────────────────
const defaultState = {
    token: null,
    user: null,
    couple: null,
    theme: 'system',
    hasNewCheckin: false,
};
// ── Helpers ───────────────────────────────────────────────────────────────────
function readFromStorage() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw)
            return { ...defaultState };
        const parsed = JSON.parse(raw);
        return { ...defaultState, ...parsed };
    }
    catch {
        return { ...defaultState };
    }
}
function writeToStorage(state) {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }
    catch {
        // ignore quota exceeded
    }
}
// ── Apply theme to document ───────────────────────────────────────────────────
export function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    }
    else if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
    }
    else {
        // system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
}
// ── Store ─────────────────────────────────────────────────────────────────────
export const store = {
    get() {
        return readFromStorage();
    },
    set(partial) {
        const current = readFromStorage();
        const next = { ...current, ...partial };
        writeToStorage(next);
        // Keep token in sync with dedicated key for apiFetch
        if (partial.token !== undefined) {
            if (partial.token) {
                localStorage.setItem(TOKEN_KEY, partial.token);
            }
            else {
                localStorage.removeItem(TOKEN_KEY);
            }
        }
        // Apply theme if changed
        if (partial.theme !== undefined) {
            applyTheme(partial.theme);
        }
    },
    clear() {
        localStorage.removeItem(STATE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        document.documentElement.removeAttribute('data-theme');
    },
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    },
    setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
        const current = readFromStorage();
        writeToStorage({ ...current, token });
    },
    isAuthenticated() {
        const token = localStorage.getItem(TOKEN_KEY);
        return !!token;
    },
    /** Initialize theme from stored state on app load */
    initTheme() {
        const state = readFromStorage();
        applyTheme(state.theme);
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
