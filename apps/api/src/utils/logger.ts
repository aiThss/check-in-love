import { env } from '../config/env';

export const logger = {
  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      message: msg,
      ...meta,
    }));
  },

  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify({
      level: 'warn',
      time: new Date().toISOString(),
      message: msg,
      ...meta,
    }));
  },

  error(msg: string, err?: unknown, meta?: Record<string, unknown>): void {
    const errorDetails = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : err;

    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      message: msg,
      error: errorDetails,
      ...meta,
    }));
  },

  debug(msg: string, meta?: Record<string, unknown>): void {
    if (env.NODE_ENV === 'development') {
      console.log(JSON.stringify({
        level: 'debug',
        time: new Date().toISOString(),
        message: msg,
        ...meta,
      }));
    }
  },
};
