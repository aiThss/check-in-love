import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function attemptConnect(attempt: number): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      logger.error(`MongoDB connection failed after ${MAX_RETRIES} attempts.`, err);
      throw err;
    }
    logger.warn(
      `MongoDB connection attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return attemptConnect(attempt + 1);
  }
}

export async function connectDB(): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.info('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err);
  });

  await attemptConnect(1);
}
