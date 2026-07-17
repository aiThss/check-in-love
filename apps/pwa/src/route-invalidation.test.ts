import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRouteInvalidations,
  consumeRouteInvalidation,
  invalidateRoutes,
} from './route-invalidation';

describe('route invalidation', () => {
  beforeEach(() => clearRouteInvalidations());

  it('normalizes paths and consumes an invalidation once', () => {
    invalidateRoutes('/app/home/?source=message');

    expect(consumeRouteInvalidation('/app/home')).toBe(true);
    expect(consumeRouteInvalidation('/app/home')).toBe(false);
  });

  it('invalidates multiple synchronized tabs independently', () => {
    invalidateRoutes(['/app/home', '/app/memories', '/app/messages']);

    expect(consumeRouteInvalidation('/app/home')).toBe(true);
    expect(consumeRouteInvalidation('/app/memories')).toBe(true);
    expect(consumeRouteInvalidation('/app/messages')).toBe(true);
  });
});
