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

  if (validRoutes.includes(path as Route)) {
    return path as Route;
  }

  return '/dashboard';
}

function renderPage(route: Route): HTMLElement {
  const auth = isAuthenticated();

  if (route === '/login') {
    if (auth) {
      navigate('/dashboard');
      return document.createElement('div');
    }
    return renderLoginPage();
  }

  if (!auth) {
    navigate('/login');
    return document.createElement('div');
  }

  switch (route) {
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

  const route = getRoute();
  const page = renderPage(route);

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
