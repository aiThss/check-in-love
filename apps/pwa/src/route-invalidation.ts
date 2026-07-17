const staleRoutes = new Set<string>();

function normalizeRoute(path: string): string {
  const pathname = path.split('?')[0] || '/';
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Marks cached route pages as stale so the router rebuilds them on the next activation. */
export function invalidateRoutes(paths: string | string[]): void {
  const values = Array.isArray(paths) ? paths : [paths];
  values.forEach((path) => staleRoutes.add(normalizeRoute(path)));
}

/** Returns true once for a stale route and consumes that invalidation. */
export function consumeRouteInvalidation(path: string): boolean {
  return staleRoutes.delete(normalizeRoute(path));
}

export function clearRouteInvalidations(): void {
  staleRoutes.clear();
}
