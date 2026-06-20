import { renderLoginPage } from './pages/login';
import { renderDashboardPage } from './pages/dashboard';
import { renderUsersPage } from './pages/users';
import { renderCouplesPage } from './pages/couples';
import { renderCheckinsPage } from './pages/checkins';
import { renderRandomPage } from './pages/random';

export type Route =
  | '/login'
  | '/dashboard'
  | '/users'
  | '/couples'
  | '/checkins'
  | '/random';

function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('admin_token'));
}

function getRoute(): Route {
  const path = window.location.pathname.replace(/\/$/, '') || '/dashboard';
  const validRoutes: Route[] = [
    '/login',
    '/dashboard',
    '/users',
    '/couples',
    '/checkins',
    '/random',
  ];

  let route = validRoutes.includes(path as Route) ? (path as Route) : '/dashboard';
  
  const auth = isAuthenticated();
  
  if (route === '/login' && auth) {
    return '/dashboard';
  }
  if (route !== '/login' && !auth) {
    return '/login';
  }
  
  return route;
}

function renderPage(route: Route): HTMLElement {
  switch (route) {
    case '/login':
      return renderLoginPage();
    case '/dashboard':
      return renderDashboardPage();
    case '/users':
      return renderUsersPage();
    case '/couples':
      return renderCouplesPage();
    case '/checkins':
      return renderCheckinsPage();
    case '/random':
      return renderRandomPage();
    default:
      return renderDashboardPage();
  }
}

export function navigate(route: Route): void {
  window.history.pushState({}, '', route);
  mount();
}

export function mount(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const originalPath = window.location.pathname.replace(/\/$/, '') || '/dashboard';
  const resolvedRoute = getRoute();

  if (originalPath !== resolvedRoute) {
    window.history.replaceState({}, '', resolvedRoute);
  }

  const page = renderPage(resolvedRoute);

  app.innerHTML = '';
  app.appendChild(page);
}

export function initRouter(): void {
  window.addEventListener('popstate', () => {
    mount();
  });

  // Intercept all internal anchor clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a[data-link]') as HTMLAnchorElement | null;
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href') as Route;
      if (href) navigate(href);
    }
  });

  mount();
}
