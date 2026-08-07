import { createNav, setActiveNav } from './components/nav';
import { consumeRouteInvalidation, clearRouteInvalidations } from './route-invalidation';
import { store } from './store/index';
import { logger } from './utils/logger';

export interface RoutePage {
  element: HTMLElement;
  activate?: () => void;
  deactivate?: () => void;
  destroy?: () => void;
}

type RouteFactory = () => HTMLElement | RoutePage | Promise<HTMLElement | RoutePage>;
type Routes = Record<string, RouteFactory>;

interface CachedPage {
  page: RoutePage;
  container: HTMLElement;
  scrollX: number;
  scrollY: number;
  cachedAt: number;
}

interface AppShell {
  pageHost: HTMLElement;
  navHost: HTMLElement;
}

const AUTO_REVALIDATE_ROUTES = new Set(['/app/home', '/app/memories']);
const AUTO_REVALIDATE_AFTER_MS = 15_000;
const APP_HISTORY_STATE_KEY = '__checkInLoveAppHistory';
const STANDALONE_FLOW_ROUTES = new Set(['/app/onboarding']);

function isAppShellRoute(path: string): boolean {
  return path.startsWith('/app/') && !STANDALONE_FLOW_ROUTES.has(path);
}

type AppHistoryKind = 'boundary' | 'route' | 'layer';
export type HistoryLayerCloseReason = 'back' | 'replace' | 'navigation';

interface AppHistoryState {
  app: true;
  kind: AppHistoryKind;
  path: string;
  layerId?: string;
}

interface HistoryLayer {
  id: string;
  close: (reason: HistoryLayerCloseReason) => void;
}

let routes: Routes = {};
let currentPath = '';
let currentElement: HTMLElement | null = null;
let currentPage: RoutePage | null = null;
let shell: AppShell | null = null;
let navigationVersion = 0;
const pageCache = new Map<string, CachedPage>();
let currentHistoryState: AppHistoryState | null = null;
let activeHistoryLayer: HistoryLayer | null = null;
let appBoundarySeeded = false;
let historyLayerSequence = 0;

export function getCurrentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function readAppHistoryState(value: unknown = history.state): AppHistoryState | null {
  if (!value || typeof value !== 'object') return null;
  const wrapped = (value as Record<string, unknown>)[APP_HISTORY_STATE_KEY];
  if (!wrapped || typeof wrapped !== 'object') return null;

  const candidate = wrapped as Partial<AppHistoryState>;
  if (candidate.app !== true || typeof candidate.path !== 'string') return null;
  if (candidate.kind !== 'boundary' && candidate.kind !== 'route' && candidate.kind !== 'layer') return null;
  if (candidate.kind === 'layer' && typeof candidate.layerId !== 'string') return null;
  return candidate as AppHistoryState;
}

function withoutAppHistoryState(value: unknown = history.state): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const next = { ...(value as Record<string, unknown>) };
  delete next[APP_HISTORY_STATE_KEY];
  return next;
}

function createAppHistoryState(kind: AppHistoryKind, path: string, layerId?: string): AppHistoryState {
  return { app: true, kind, path, ...(layerId ? { layerId } : {}) };
}

function writeAppHistoryState(
  method: 'push' | 'replace',
  state: AppHistoryState,
  url = state.path,
): void {
  const next = withoutAppHistoryState();
  next[APP_HISTORY_STATE_KEY] = state;
  if (method === 'replace') history.replaceState(next, '', url);
  else history.pushState(next, '', url);
  currentHistoryState = state;
}

function writeRouteHistory(path: string, replace: boolean): void {
  const target = new URL(path, window.location.origin);
  const nextPath = target.pathname + target.search;
  const state = withoutAppHistoryState();
  const appRoute = isAppShellRoute(target.pathname);
  const appState = appRoute && appBoundarySeeded
    ? createAppHistoryState('route', nextPath)
    : null;

  if (appState) state[APP_HISTORY_STATE_KEY] = appState;
  if (replace) history.replaceState(state, '', nextPath);
  else history.pushState(state, '', nextPath);
  currentHistoryState = appState;
}

function ensureAppHistoryBoundary(path: string): void {
  const target = new URL(path, window.location.origin);
  if (!store.isAuthenticated() || !isAppShellRoute(target.pathname)) return;

  const nextPath = target.pathname + target.search;
  if (appBoundarySeeded) {
    const existing = readAppHistoryState();
    if (!existing || existing.kind === 'boundary') {
      writeAppHistoryState('replace', createAppHistoryState('route', nextPath), nextPath);
    } else {
      currentHistoryState = existing;
    }
    return;
  }

  appBoundarySeeded = true;
  writeAppHistoryState('replace', createAppHistoryState('boundary', nextPath), nextPath);
  writeAppHistoryState('push', createAppHistoryState('route', nextPath), nextPath);
}

function closeActiveHistoryLayerForNavigation(): void {
  const layer = activeHistoryLayer;
  if (!layer) return;
  activeHistoryLayer = null;
  layer.close('navigation');
  writeRouteHistory(getCurrentPath(), true);
}

export function openHistoryLayer(close: (reason: HistoryLayerCloseReason) => void): string {
  const path = getCurrentPath();
  ensureAppHistoryBoundary(path);
  const id = 'layer-' + Date.now() + '-' + (++historyLayerSequence);

  if (activeHistoryLayer) {
    const previous = activeHistoryLayer;
    activeHistoryLayer = null;
    previous.close('replace');
    writeAppHistoryState('replace', createAppHistoryState('layer', path, id), path);
  } else {
    writeAppHistoryState('push', createAppHistoryState('layer', path, id), path);
  }

  activeHistoryLayer = { id, close };
  return id;
}

export function closeHistoryLayer(id: string): void {
  if (activeHistoryLayer?.id !== id) return;
  activeHistoryLayer = null;
  const state = readAppHistoryState();
  if (state?.kind === 'layer' && state.layerId === id) history.back();
}

export function navigate(path: string, replace = false): void {
  const target = new URL(path, window.location.origin);
  const nextPath = `${target.pathname}${target.search}`;

  closeActiveHistoryLayerForNavigation();

  if (nextPath === getCurrentPath()) {
    void renderRoute(target.pathname, nextPath);
    return;
  }

  writeRouteHistory(nextPath, replace);
  void renderRoute(target.pathname, nextPath);
}

/** Removes authenticated DOM and its in-memory UI state. */
export function clearPageCache(): void {
  for (const cached of pageCache.values()) {
    cached.page.destroy?.();
    cached.container.remove();
  }
  pageCache.clear();
  clearRouteInvalidations();
  if (currentPath.startsWith('/app/')) {
    currentElement = null;
    currentPage = null;
  }
}

export function initRouter(nextRoutes: Routes): void {
  routes = nextRoutes;
  ensureShell();
  currentHistoryState = readAppHistoryState();
  ensureAppHistoryBoundary(getCurrentPath());

  window.addEventListener('popstate', (event) => {
    const previousState = currentHistoryState;
    let nextState = readAppHistoryState(event.state);
    currentHistoryState = nextState;

    if (previousState?.kind === 'layer') {
      const layer = activeHistoryLayer;
      activeHistoryLayer = null;
      if (layer && layer.id === previousState.layerId) layer.close('back');
    }

    if (nextState?.kind === 'layer' && activeHistoryLayer?.id !== nextState.layerId) {
      writeRouteHistory(getCurrentPath(), true);
      nextState = currentHistoryState;
    }

    if (
      nextState?.kind === 'boundary'
      && store.isAuthenticated()
      && window.location.pathname.startsWith('/app/')
    ) {
      const fallbackPath = previousState?.path?.startsWith('/app/')
        ? previousState.path
        : '/app/home';
      const fallback = new URL(fallbackPath, window.location.origin);
      const normalized = fallback.pathname + fallback.search;
      writeAppHistoryState('replace', createAppHistoryState('boundary', normalized), normalized);
      writeAppHistoryState('push', createAppHistoryState('route', normalized), normalized);
      void renderRoute(fallback.pathname, normalized);
      return;
    }

    void renderRoute(window.location.pathname, getCurrentPath());
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

  void renderRoute(window.location.pathname, getCurrentPath());
}

function ensureShell(): AppShell | null {
  if (shell) return shell;

  const app = document.getElementById('app');
  if (!app) return null;

  const appShell = document.createElement('div');
  appShell.id = 'app-shell';
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

function createPageContainer(path: string, page: RoutePage): HTMLElement {
  const container = document.createElement('section');
  container.className = 'route-page';
  container.dataset.routePage = path;
  setPageVisibility(container, false);
  container.appendChild(page.element);
  return container;
}

function setPageVisibility(container: HTMLElement, visible: boolean): void {
  container.hidden = !visible;
  container.toggleAttribute('inert', !visible);
  container.setAttribute('aria-hidden', visible ? 'false' : 'true');
  container.classList.toggle('is-active', visible);
}

function setOnlyActivePage(host: HTMLElement, activeContainer: HTMLElement): void {
  host.querySelectorAll<HTMLElement>('[data-route-page]').forEach((container) => {
    setPageVisibility(container, container === activeContainer);
  });
}

function shouldRevalidateCachedRoute(path: string, cached: CachedPage): boolean {
  if (consumeRouteInvalidation(path)) return true;
  return AUTO_REVALIDATE_ROUTES.has(path) && Date.now() - cached.cachedAt >= AUTO_REVALIDATE_AFTER_MS;
}

function evictCachedRoute(path: string, cached: CachedPage): void {
  cached.page.destroy?.();
  cached.container.remove();
  pageCache.delete(path);

  if (currentPage === cached.page) {
    currentPage = null;
    currentElement = null;
  }
}

async function renderRoute(path: string, locationPath = getCurrentPath()): Promise<void> {
  const activeShell = ensureShell();
  if (!activeShell) return;

  const version = ++navigationVersion;
  const redirect = getRedirect(path);
  if (redirect) {
    navigate(redirect, true);
    return;
  }

  const resolvedPath = resolveRoute(path);
  const location = new URL(locationPath, window.location.origin);
  const pageKey = `${resolvedPath}${location.search}`;
  if (isAppShellRoute(resolvedPath)) ensureAppHistoryBoundary(getCurrentPath());
  const factory = routes[resolvedPath];
  if (!factory) {
    renderMessage(activeShell.pageHost, 'Không tìm thấy trang', 'Trang này không tồn tại.');
    return;
  }

  const isAppRoute = isAppShellRoute(resolvedPath);
  saveCurrentScroll();

  try {
    let nextPage: RoutePage;
    let nextContainer: HTMLElement;
    let restoredScroll: Pick<CachedPage, 'scrollX' | 'scrollY'> | undefined;
    let cachedPage: CachedPage | undefined;

    if (isAppRoute) {
      cachedPage = pageCache.get(pageKey);
      if (cachedPage && shouldRevalidateCachedRoute(resolvedPath, cachedPage)) {
        restoredScroll = { scrollX: cachedPage.scrollX, scrollY: cachedPage.scrollY };
        evictCachedRoute(pageKey, cachedPage);
        cachedPage = undefined;
      } else if (!cachedPage) {
        // Consume an invalidation created before the page was mounted.
        consumeRouteInvalidation(resolvedPath);
      }
    }

    if (cachedPage) {
      nextPage = cachedPage.page;
      nextContainer = cachedPage.container;
      restoredScroll = cachedPage;
    } else {
      nextPage = normalizeRoutePage(await factory());
      if (version !== navigationVersion) return;

      nextContainer = createPageContainer(pageKey, nextPage);

      if (isAppRoute) {
        pageCache.set(pageKey, {
          page: nextPage,
          container: nextContainer,
          scrollX: restoredScroll?.scrollX ?? 0,
          scrollY: restoredScroll?.scrollY ?? 0,
          cachedAt: Date.now(),
        });
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
    if (currentPage && currentPage !== nextPage) currentPage.deactivate?.();

    activeShell.navHost.hidden = !isAppRoute;
    const isStandaloneFlow = resolvedPath === '/onboarding' || STANDALONE_FLOW_ROUTES.has(resolvedPath);
    const devHelper = document.getElementById('dev-helper-root');
    if (devHelper) devHelper.style.display = isStandaloneFlow ? 'none' : '';
    if (isAppRoute) setActiveNav(resolvedPath);
    if (!nextContainer.isConnected) activeShell.pageHost.appendChild(nextContainer);
    setOnlyActivePage(activeShell.pageHost, nextContainer);
    if (!cachedPage) nextPage.element.classList.add('page-enter');

    currentPath = pageKey;
    currentElement = nextContainer;
    currentPage = nextPage;
    nextPage.activate?.();

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

function normalizeRoutePage(result: HTMLElement | RoutePage): RoutePage {
  return result instanceof HTMLElement ? { element: result } : result;
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
  const container = createPageContainer('route-error', { element: page });
  host.replaceChildren(container);
  setOnlyActivePage(host, container);
  currentElement = container;
  currentPage = { element: page };
}
