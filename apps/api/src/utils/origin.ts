import { env } from '../config/env';

export function isDevelopmentOrigin(origin: string): boolean {
  if (env.NODE_ENV !== 'development') return false;

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
