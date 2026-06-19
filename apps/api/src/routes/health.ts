import type { FastifyInstance } from 'fastify';

export default async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });
}
