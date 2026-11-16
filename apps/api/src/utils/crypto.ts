import bcrypt from 'bcryptjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 30 * 24 * 60 * 60,
): Promise<string> {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const signingInput = `${header}.${body}`;
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<T | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(decoder.decode(base64UrlDecode(headerB64))) as { alg?: string };
    if (header.alg !== 'HS256') return null;

    const key = await importHmacKey(secret);
    const sigBytes = base64UrlDecode(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64))) as T & { exp?: number };
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 100_000;
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$${iterations}$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith('pbkdf2_sha256$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number.parseInt(parts[1], 10);
    if (!Number.isFinite(iterations) || iterations < 10_000) return false;
    const salt = base64UrlDecode(parts[2]);
    const expected = base64UrlDecode(parts[3]);
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      expected.length * 8,
    );
    return timingSafeEqualBytes(new Uint8Array(derivedBits), expected);
  }
  if (storedHash.startsWith('$2')) {
    return bcrypt.compare(password, storedHash);
  }
  return false;
}

export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100_000 + (buf[0] % 900_000));
}

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: number;
}

interface GoogleJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
}

let cachedGoogleCerts: { keys: GoogleJwk[]; expiresAt: number } | null = null;

async function fetchGoogleJwks(): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.keys;
  }

  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
  }
  const cacheControl = res.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600_000;
  const body = (await res.json()) as { keys?: GoogleJwk[] };
  const keys = body.keys ?? [];
  cachedGoogleCerts = { keys, expiresAt: now + ttlMs };
  return keys;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string,
  jwksLoader: () => Promise<GoogleJwk[]> = fetchGoogleJwks,
): Promise<GoogleTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google token format');

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(decoder.decode(base64UrlDecode(headerB64))) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Invalid Google token header');
  }

  const keys = await jwksLoader();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk && jwksLoader === fetchGoogleJwks) {
    cachedGoogleCerts = null;
    const freshKeys = await fetchGoogleJwks();
    jwk = freshKeys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error('Google signing key not found');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlDecode(sigB64),
    encoder.encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) {
    throw new Error('Google token signature invalid');
  }

  const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64))) as GoogleTokenPayload;
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('Google token issuer mismatch');
  }
  if (!expectedClientId || payload.aud !== expectedClientId) {
    throw new Error('Google token audience mismatch');
  }
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Google token expired');
  }
  if (!payload.sub) {
    throw new Error('Google token missing subject');
  }

  return payload;
}
