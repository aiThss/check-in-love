import { buildApp } from './app';
import { env } from './config/env';
import { connectDB } from './db/connection';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Build Fastify app
  const app = await buildApp();

  // 3. Init cron jobs
  const { initCronJobs } = await import('./services/cron');
  initCronJobs();

  // 4. Start listening
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`🚀 API running on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    logger.error('API failed to start', err);
    process.exit(1);
  }

  // 4. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      logger.info('Server closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal error during startup', err);
  process.exit(1);
});
