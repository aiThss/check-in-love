import { buildApp } from './app';
import { env } from './config/env';
import { connectDB } from './db/connection';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  // 1. Connect to MongoDB
  await connectDB();

  // One-time migration to update user email to new primary and add old email as alias
  try {
    const { User } = await import('./db/models/User');
    const oldEmail = 'duongdanh245@gmail.com';
    const newEmail = 'danhthai4560@gmail.com';

    const migratedUser = await User.findOneAndUpdate(
      { email: oldEmail },
      {
        $set: { email: newEmail },
        $addToSet: { email_aliases: oldEmail },
      },
      { new: true },
    );

    if (migratedUser) {
      logger.info(
        `[Migration] Successfully updated user ${migratedUser.displayName}: ${oldEmail} -> ${newEmail} (with alias ${oldEmail})`,
      );
    } else {
      logger.info(
        `[Migration] No user found with email ${oldEmail} to migrate, or already migrated.`,
      );
    }
  } catch (err) {
    logger.error('[Migration] Failed to run email update migration', err);
  }

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
