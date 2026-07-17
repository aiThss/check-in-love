export interface QueryOptions {
  staleTime?: number;
  force?: boolean;
}

interface QueryEntry<T> {
  data?: T;
  updatedAt: number;
  version: number;
  request?: Promise<T>;
}

const queries = new Map<string, QueryEntry<unknown>>();
const mutations = new Map<string, Promise<unknown>>();

export function getCachedQuery<T>(key: string): T | undefined {
  return queries.get(key)?.data as T | undefined;
}

export async function fetchQuery<T>(
  key: string,
  loader: () => Promise<T>,
  { staleTime = 30_000, force = false }: QueryOptions = {},
): Promise<T> {
  const existing = queries.get(key) as QueryEntry<T> | undefined;
  const isFresh = existing?.data !== undefined && Date.now() - existing.updatedAt < staleTime;
  if (!force && isFresh) return existing.data as T;
  if (existing?.request) return existing.request;

  const entry: QueryEntry<T> = existing ?? { updatedAt: 0, version: 0 };
  const requestVersion = entry.version;
  const request = loader()
    .then((data) => {
      // An invalidation can start a newer request while this one is in flight.
      // Never let this older response replace the newer cached value.
      if (entry.version === requestVersion) {
        entry.data = data;
        entry.updatedAt = Date.now();
      }
      return data;
    })
    .catch((error: unknown) => {
      // A stale value is still more useful than a blank screen when refreshing fails.
      if (entry.data !== undefined) return entry.data;
      throw error;
    })
    .finally(() => {
      if (entry.request === request) entry.request = undefined;
    });

  entry.request = request;
  queries.set(key, entry);
  return request;
}

export function invalidateQueries(prefix: string): void {
  for (const [key, entry] of queries) {
    if (key.startsWith(prefix)) {
      entry.updatedAt = 0;
      entry.version++;
      entry.request = undefined;
    }
  }
}

export function updateCachedQuery<T>(
  key: string,
  updater: (current: T | undefined) => T | undefined,
): () => void {
  const entry = queries.get(key) as QueryEntry<T> | undefined;
  const previous = entry?.data;
  const next = updater(previous);

  if (next === undefined) {
    queries.delete(key);
  } else {
    queries.set(key, { ...entry, version: entry?.version ?? 0, data: next, updatedAt: Date.now() });
  }

  return () => {
    if (previous === undefined) queries.delete(key);
    else queries.set(key, { ...entry, version: entry?.version ?? 0, data: previous, updatedAt: Date.now() });
  };
}

export function updateMatchingQueries(
  prefix: string,
  updater: (current: unknown) => unknown,
): void {
  for (const [key, entry] of queries) {
    if (key.startsWith(prefix) && entry.data !== undefined) {
      entry.data = updater(entry.data);
      entry.updatedAt = Date.now();
    }
  }
}

export async function dedupeMutation<T>(key: string, mutation: () => Promise<T>): Promise<T> {
  const pending = mutations.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = mutation().finally(() => mutations.delete(key));
  mutations.set(key, request);
  return request;
}

export function clearQueryCache(): void {
  queries.clear();
  mutations.clear();
}
