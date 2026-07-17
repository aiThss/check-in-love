import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearQueryCache,
  dedupeMutation,
  fetchQuery,
  getCachedQuery,
  invalidateQueries,
  updateCachedQuery,
} from './query-cache';

afterEach(clearQueryCache);

describe('query cache', () => {
  it('returns a fresh cached value without a second request', async () => {
    const loader = vi.fn().mockResolvedValue({ value: 1 });

    await fetchQuery('profile', loader);
    const result = await fetchQuery('profile', loader);

    expect(result).toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same key', async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const loader = vi.fn(
      () => new Promise<string>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = fetchQuery('latest', loader, { force: true });
    const second = fetchQuery('latest', loader, { force: true });
    resolveRequest?.('ready');

    await expect(Promise.all([first, second])).resolves.toEqual(['ready', 'ready']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps stale data visible while a revalidation is in flight', async () => {
    await fetchQuery('latest', async () => 'cached');
    let resolveRequest: ((value: string) => void) | undefined;

    const revalidation = fetchQuery(
      'latest',
      () => new Promise<string>((resolve) => { resolveRequest = resolve; }),
      { force: true },
    );

    expect(getCachedQuery('latest')).toBe('cached');
    resolveRequest?.('fresh');
    await expect(revalidation).resolves.toBe('fresh');
    expect(getCachedQuery('latest')).toBe('fresh');
  });

  it('does not let an invalidated older response overwrite a newer response', async () => {
    let resolveOld: ((value: string) => void) | undefined;
    let resolveNew: ((value: string) => void) | undefined;
    const oldRequest = fetchQuery('timeline', () => new Promise<string>((resolve) => { resolveOld = resolve; }));

    invalidateQueries('timeline');
    const newRequest = fetchQuery('timeline', () => new Promise<string>((resolve) => { resolveNew = resolve; }));
    resolveNew?.('new');
    await expect(newRequest).resolves.toBe('new');
    resolveOld?.('old');
    await expect(oldRequest).resolves.toBe('old');

    expect(getCachedQuery('timeline')).toBe('new');
  });

  it('returns stale data on refresh failure but throws when no cache exists', async () => {
    await fetchQuery('settings', async () => 'cached');

    await expect(fetchQuery('settings', async () => { throw new Error('offline'); }, { force: true }))
      .resolves.toBe('cached');
    await expect(fetchQuery('missing', async () => { throw new Error('offline'); }))
      .rejects.toThrow('offline');
  });

  it('rolls an optimistic cached update back on request', async () => {
    await fetchQuery('item', async () => ({ liked: false }));
    const rollback = updateCachedQuery<{ liked: boolean }>('item', (item) => ({ ...item!, liked: true }));

    expect(getCachedQuery('item')).toEqual({ liked: true });
    rollback();
    expect(getCachedQuery('item')).toEqual({ liked: false });
  });

  it('deduplicates an in-flight mutation', async () => {
    const mutation = vi.fn().mockResolvedValue('done');
    await expect(Promise.all([dedupeMutation('reply:1', mutation), dedupeMutation('reply:1', mutation)])).resolves.toEqual(['done', 'done']);
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('clears cached private data on logout', async () => {
    await fetchQuery('checkins:user-a', async () => 'private');
    clearQueryCache();
    expect(getCachedQuery('checkins:user-a')).toBeUndefined();
  });
});
