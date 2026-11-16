export interface WorkerEnv {
  DB: D1Database;
  STORAGE: R2Bucket;
  REALTIME_HUB?: DurableObjectNamespace;

  NODE_ENV?: string;
  JWT_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_ENABLE_TEST_RESET?: string;
  PUBLIC_BASE_URL?: string;
  MAX_UPLOAD_MB?: string;
  ALLOWED_ORIGINS?: string;

  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;

  VAPID_EMAIL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  FCM_SERVICE_ACCOUNT_JSON?: string;

  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_URL?: string;

  MOCK_EMAIL?: string;
}

export interface AppConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_ENABLE_TEST_RESET: boolean;
  PUBLIC_BASE_URL: string;
  MAX_UPLOAD_MB: number;
  ALLOWED_ORIGINS: string[];

  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;

  VAPID_EMAIL: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  GOOGLE_CLIENT_ID: string;
  FCM_SERVICE_ACCOUNT_JSON: string;

  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;

  MOCK_EMAIL: boolean;
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  const num = Number.parseInt(value ?? '', 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

export function resolveConfig(raw?: Partial<WorkerEnv>): AppConfig {
  const proc = typeof process !== 'undefined' ? (process.env as Partial<WorkerEnv>) : {};
  const src = { ...proc, ...raw };

  const nodeEnvRaw = (src.NODE_ENV ?? 'production').trim();
  const nodeEnv: AppConfig['NODE_ENV'] =
    nodeEnvRaw === 'development' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'production';

  const allowedOrigins = (src.ALLOWED_ORIGINS ?? 'https://couple.io.vn,https://admin.couple.io.vn')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    NODE_ENV: nodeEnv,
    JWT_SECRET: (src.JWT_SECRET ?? '').trim() || (nodeEnv === 'test' ? 'test-jwt-secret-key-min-32-chars!!' : ''),
    ADMIN_EMAIL: (src.ADMIN_EMAIL ?? '').trim().toLowerCase(),
    ADMIN_PASSWORD: src.ADMIN_PASSWORD ?? '',
    ADMIN_ENABLE_TEST_RESET: parseBool(src.ADMIN_ENABLE_TEST_RESET, false),
    PUBLIC_BASE_URL: (src.PUBLIC_BASE_URL ?? 'https://api.couple.io.vn').trim().replace(/\/+$/, ''),
    MAX_UPLOAD_MB: parseIntSafe(src.MAX_UPLOAD_MB, 20),
    ALLOWED_ORIGINS: allowedOrigins,

    SMTP_HOST: (src.SMTP_HOST ?? '').trim(),
    SMTP_PORT: parseIntSafe(src.SMTP_PORT, 587),
    SMTP_SECURE: parseBool(src.SMTP_SECURE, false),
    SMTP_USER: (src.SMTP_USER ?? '').trim(),
    SMTP_PASS: src.SMTP_PASS ?? '',
    SMTP_FROM: (src.SMTP_FROM ?? 'Check IN Love <support@couple.io.vn>').trim(),

    VAPID_EMAIL: (src.VAPID_EMAIL ?? 'admin@couple.io.vn').trim(),
    VAPID_PUBLIC_KEY: (src.VAPID_PUBLIC_KEY ?? '').trim(),
    VAPID_PRIVATE_KEY: (src.VAPID_PRIVATE_KEY ?? '').trim(),
    GOOGLE_CLIENT_ID: (src.GOOGLE_CLIENT_ID ?? '').trim(),
    FCM_SERVICE_ACCOUNT_JSON: (src.FCM_SERVICE_ACCOUNT_JSON ?? '').trim(),

    R2_ACCOUNT_ID: (src.R2_ACCOUNT_ID ?? '').trim(),
    R2_BUCKET_NAME: (src.R2_BUCKET_NAME ?? 'check-in-love-storage').trim(),
    R2_PUBLIC_URL: (src.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, ''),

    MOCK_EMAIL: parseBool(src.MOCK_EMAIL, nodeEnv === 'test'),
  };
}
