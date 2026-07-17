import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearQueryCache,
  dedupeMutation,
  fetchQuery,
  getCachedQuery,
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
});
