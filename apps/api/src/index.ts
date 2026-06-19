import { buildApp } from './app';
import { env } from './config/env';
import { connectDB } from './db/connection';

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
    console.log(`🚀 API running on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // 4. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      console.log('Server closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
