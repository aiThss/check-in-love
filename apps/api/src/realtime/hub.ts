const encoder = new TextEncoder();

interface ConnectedClient {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  heartbeat: ReturnType<typeof setInterval>;
}

export class RealtimeHub {
  private readonly clients = new Set<ConnectedClient>();

  constructor(_state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/emit') {
      const payload = await request.text();
      const frame = encoder.encode(`data: ${payload}\n\n`);
      const stale: ConnectedClient[] = [];
      for (const client of this.clients) {
        try {
          await client.writer.write(frame);
        } catch {
          stale.push(client);
        }
      }
      for (const dead of stale) {
        clearInterval(dead.heartbeat);
        this.clients.delete(dead);
        dead.writer.close().catch(() => null);
      }
      return new Response(JSON.stringify({ delivered: this.clients.size }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'GET' && url.pathname === '/connect') {
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();

      const client: ConnectedClient = {
        writer,
        heartbeat: setInterval(() => {
          writer.write(encoder.encode(': ping\n\n')).catch(() => {
            clearInterval(client.heartbeat);
            this.clients.delete(client);
            writer.close().catch(() => null);
          });
        }, 25_000),
      };

      this.clients.add(client);

      const initial = encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      writer.write(initial).catch(() => {
        clearInterval(client.heartbeat);
        this.clients.delete(client);
      });

      request.signal.addEventListener('abort', () => {
        clearInterval(client.heartbeat);
        this.clients.delete(client);
        writer.close().catch(() => null);
      });

      return new Response(readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
