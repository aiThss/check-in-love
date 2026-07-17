import { createNav, setActiveNav } from './components/nav';
import { store } from './store/index';
import { logger } from './utils/logger';

type RouteFactory = () => HTMLElement | Promise<HTMLElement>;
type Routes = Record<string, RouteFactory>;

interface CachedPage {
  element: HTMLElement;
  scrollX: number;
  scrollY: number;
}

interface AppShell {
  pageHost: HTMLElement;
  navHost: HTMLElement;
}

let routes: Routes = {};
let currentPath = '';
let currentElement: HTMLElement | null = null;
let shell: AppShell | null = null;
let navigationVersion = 0;
const pageCache = new Map<string, CachedPage>();

export function getCurrentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function navigate(path: string, replace = false): void {
  const target = new URL(path, window.location.origin);
  const nextPath = `${target.pathname}${target.search}`;

  if (nextPath === getCurrentPath()) {
    void renderRoute(target.pathname);
    return;
  }

  if (replace) {
    history.replaceState({}, '', nextPath);
  } else {
    history.pushState({}, '', nextPath);
  }
  void renderRoute(target.pathname);
}

/** Removes authenticated DOM and its in-memory UI state. */
export function clearPageCache(): void {
  for (const cached of pageCache.values()) {
    cached.element.remove();
  }
  pageCache.clear();
  if (currentPath.startsWith('/app/')) {
    currentElement = null;
  }
}

export function initRouter(nextRoutes: Routes): void {
  routes = nextRoutes;
  ensureShell();

  window.addEventListener('popstate', () => {
    void renderRoute(window.location.pathname);
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(href)) return;

    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin) return;

    event.preventDefault();
    navigate(`${target.pathname}${target.search}`);
  });

  void renderRoute(window.location.pathname);
}

function ensureShell(): AppShell | null {
  if (shell) return shell;

  const app = document.getElementById('app');
  if (!app) return null;

  const appShell = document.createElement('div');
  appShell.className = 'app-shell';

  const pageHost = document.createElement('main');
  pageHost.id = 'page-host';
  pageHost.setAttribute('aria-live', 'polite');

  const navHost = document.createElement('div');
  navHost.id = 'navigation-root';
  navHost.appendChild(createNav());

  const modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';

  const toastRoot = document.createElement('div');
  toastRoot.id = 'toast-root';

  appShell.append(pageHost, navHost, modalRoot, toastRoot);
  app.replaceChildren(appShell);
  shell = { pageHost, navHost };
  return shell;
}

function resolveRoute(path: string): string {
  if (routes[path]) return path;
  const normalized = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  return routes[normalized] ? normalized : '/';
}

function getRedirect(path: string): string | null {
  const authenticated = store.isAuthenticated();
  const appRoute = path.startsWith('/app/');
  const authRoute = path === '/onboarding' || path === '/login' || path === '/';

  if (appRoute && !authenticated) return '/onboarding';
  if (authRoute && authenticated) return '/app/home';
  return null;
}

function saveCurrentScroll(): void {
  const cached = pageCache.get(currentPath);
  if (cached) {
    cached.scrollX = window.scrollX;
    cached.scrollY = window.scrollY;
  }
}

async function renderRoute(path: string): Promise<void> {
  const activeShell = ensureShell();
  if (!activeShell) return;

  const version = ++navigationVersion;
  const redirect = getRedirect(path);
  if (redirect) {
    navigate(redirect, true);
    return;
  }

  const resolvedPath = resolveRoute(path);
  const factory = routes[resolvedPath];
  if (!factory) {
    renderMessage(activeShell.pageHost, 'Không tìm thấy trang', 'Trang này không tồn tại.');
    return;
  }

  const isAppRoute = resolvedPath.startsWith('/app/');
  saveCurrentScroll();

  try {
    let nextElement: HTMLElement;
    let restoredScroll: CachedPage | undefined;

    if (isAppRoute) {
      restoredScroll = pageCache.get(resolvedPath);
    }

    if (restoredScroll) {
      nextElement = restoredScroll.element;
    } else {
      nextElement = await factory();
      if (version !== navigationVersion) return;

      if (isAppRoute) {
        pageCache.set(resolvedPath, { element: nextElement, scrollX: 0, scrollY: 0 });
      }
    }

    if (version !== navigationVersion) return;

    if (isAppRoute && currentElement && !currentPath.startsWith('/app/')) {
      currentElement.remove();
      currentElement = null;
    }
    if (!isAppRoute) {
      clearPageCache();
      activeShell.pageHost.replaceChildren();
    }
    if (currentElement && currentElement !== nextElement) currentElement.hidden = true;

    activeShell.navHost.hidden = !isAppRoute;
    if (isAppRoute) setActiveNav(resolvedPath);
    nextElement.hidden = false;
    if (!nextElement.isConnected) activeShell.pageHost.appendChild(nextElement);
    if (!restoredScroll) nextElement.classList.add('page-enter');

    currentPath = resolvedPath;
    currentElement = nextElement;

    requestAnimationFrame(() => {
      if (version !== navigationVersion) return;
      window.scrollTo({
        left: restoredScroll?.scrollX ?? 0,
        top: restoredScroll?.scrollY ?? 0,
        behavior: 'auto',
      });
    });
  } catch (error) {
    if (version !== navigationVersion) return;
    logger.error(`[Router] Failed to render route: ${resolvedPath}`, error);
    renderMessage(activeShell.pageHost, 'Có lỗi xảy ra', 'Vui lòng thử lại.');
  }
}

function renderMessage(host: HTMLElement, title: string, description: string): void {
  clearPageCache();
  const page = document.createElement('div');
  page.className = 'page page-no-nav route-message';
  const heading = document.createElement('h1');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  page.append(heading, copy);
  host.replaceChildren(page);
  currentElement = page;
}
