import { describe, expect, it, vi } from 'vitest';
import healthRoute from './health';

describe('health route', () => {
  it('registers and returns an OK response for health probes', async () => {
    let handler: ((request: unknown, reply: any) => Promise<unknown>) | undefined;
    const app = { get: vi.fn((_path: string, nextHandler: typeof handler) => { handler = nextHandler; }) };
    await healthRoute(app as any);
    const reply = { status: vi.fn(), send: vi.fn((value) => value) };
    reply.status.mockReturnValue(reply);

    await handler?.({}, reply);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', version: '1.0.0' }));
  });
});
