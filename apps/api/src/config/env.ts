import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .optional()
    .default('3001')
    .transform((v) => parseInt(v, 10)),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  PUBLIC_BASE_URL: z.string().url('PUBLIC_BASE_URL must be a valid URL'),
  UPLOAD_DIR: z.string().default('/app/uploads'),
  MAX_UPLOAD_MB: z
    .string()
    .optional()
    .default('10')
    .transform((v) => parseInt(v, 10)),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001,http://localhost:5173,https://couple.babyress.games,https://admin.couple.babyress.games')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().email().optional(),
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  ADMIN_ENABLE_TEST_RESET: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  FCM_SERVER_KEY: z.string().optional(),
  FCM_SERVICE_ACCOUNT_FILE: z.string().optional(),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  [${e.path.join('.')}] ${e.message}`)
      .join('\n');
    throw new Error(`Environment variable validation failed:\n${formatted}`);
  }

  return result.data;
}

export const env = parseEnv();

export type Env = typeof env;
