import type { AppConfig } from '../config/env';

export function isDevelopmentOrigin(origin: string, nodeEnv: AppConfig['NODE_ENV'] = 'production'): boolean {
  if (nodeEnv !== 'development') return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return true;
    }

    const octets = host.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }

    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string | undefined, config: AppConfig): string | null {
  if (!origin) return null;
  if (config.ALLOWED_ORIGINS.includes(origin) || isDevelopmentOrigin(origin, config.NODE_ENV)) {
    return origin;
  }
  // Allow Capacitor / Cloudflare Pages preview origins under couple-io-vn if explicitly in ALLOWED_ORIGINS,
  // plus standard *.pages.dev previews for check-in-love when requested securely via HTTPS.
  try {
    const url = new URL(origin);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'couple.io.vn' ||
        url.hostname === 'admin.couple.io.vn' ||
        url.hostname === 'check-in-love.pages.dev' ||
        url.hostname.endsWith('.check-in-love.pages.dev') ||
        url.hostname === 'check-in-love-admin.pages.dev' ||
        url.hostname.endsWith('.check-in-love-admin.pages.dev'))
    ) {
      return origin;
    }
  } catch {
    return null;
  }
  return null;
}
