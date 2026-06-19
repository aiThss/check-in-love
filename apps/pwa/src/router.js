import { store } from './store/index';
// ── State ─────────────────────────────────────────────────────────────────────
let _routes = {};
let _currentPath = '';
// ── Public API ────────────────────────────────────────────────────────────────
export function getCurrentPath() {
    return window.location.pathname;
}
export function navigate(path, replace = false) {
    if (replace) {
        history.replaceState({}, '', path);
    }
    else {
        history.pushState({}, '', path);
    }
    renderRoute(path);
}
export function initRouter(routes) {
    _routes = routes;
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        renderRoute(window.location.pathname);
    });
    // Intercept internal link clicks
    document.addEventListener('click', (e) => {
        const target = e.target;
        const anchor = target.closest('a');
        if (!anchor)
            return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('//'))
            return;
        e.preventDefault();
        navigate(href);
    });
    // Render initial route
    renderRoute(window.location.pathname);
}
// ── Route resolution ──────────────────────────────────────────────────────────
function resolveRoute(path) {
    // Exact match
    if (_routes[path])
        return path;
    // Normalize trailing slash
    const normalized = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
    if (_routes[normalized])
        return normalized;
    // Default fallback
    return '/';
}
function getRedirect(path) {
    const isAuthenticated = store.isAuthenticated();
    const isAppRoute = path.startsWith('/app/');
    const isAuthRoute = path === '/onboarding' || path === '/';
    // Protect /app/* routes
    if (isAppRoute && !isAuthenticated) {
        return '/onboarding';
    }
    // Redirect authenticated users away from onboarding/root
    if (isAuthRoute && isAuthenticated) {
        return '/app/home';
    }
    return null;
}
async function renderRoute(path) {
    _currentPath = path;
    // Check redirect
    const redirect = getRedirect(path);
    if (redirect) {
        navigate(redirect, true);
        return;
    }
    const resolvedPath = resolveRoute(path);
    const factory = _routes[resolvedPath];
    if (!factory) {
        renderNotFound();
        return;
    }
    const appEl = document.getElementById('app');
    if (!appEl)
        return;
    // Fade out
    appEl.style.opacity = '0';
    appEl.style.transition = `opacity 120ms ease`;
    try {
        const pageEl = await factory();
        appEl.innerHTML = '';
        appEl.appendChild(pageEl);
    }
    catch (err) {
        console.error('[Router] Failed to render route:', resolvedPath, err);
        renderError(appEl);
    }
    // Fade in
    requestAnimationFrame(() => {
        appEl.style.opacity = '1';
        // Scroll to top on route change
        window.scrollTo({ top: 0 });
    });
}
function renderNotFound() {
    const appEl = document.getElementById('app');
    if (!appEl)
        return;
    appEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;text-align:center;padding:32px">
      <div style="font-size:64px">🔍</div>
      <div style="font-size:20px;font-weight:600">Không tìm thấy trang</div>
      <div style="font-size:15px;color:var(--text-secondary)">Trang này không tồn tại</div>
      <button class="btn-ghost" onclick="history.back()" style="margin-top:8px">← Quay lại</button>
    </div>
  `;
}
function renderError(container) {
    container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;text-align:center;padding:32px">
      <div style="font-size:64px">😢</div>
      <div style="font-size:20px;font-weight:600">Có lỗi xảy ra</div>
      <div style="font-size:15px;color:var(--text-secondary)">Vui lòng thử lại</div>
      <button class="btn-ghost" onclick="window.location.reload()" style="margin-top:8px">Tải lại</button>
    </div>
  `;
}
