import { base64UrlDecode, base64UrlEncode } from '../utils/crypto';

const encoder = new TextEncoder();

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VapidConfig {
  email: string;
  publicKey: string;
  privateKey: string;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const input = concatBytes(info, new Uint8Array([1]));
  const okm = await hmacSha256(prk, input);
  return okm.slice(0, length);
}

export async function createVapidJwt(endpoint: string, vapid: VapidConfig): Promise<string> {
  const url = new URL(endpoint);
  const audience = url.origin;
  const sub = vapid.email.startsWith('mailto:') || vapid.email.startsWith('https://')
    ? vapid.email
    : `mailto:${vapid.email}`;

  const pubBytes = base64UrlDecode(vapid.publicKey);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID_PUBLIC_KEY format (expected 65-byte uncompressed P-256 point)');
  }
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: vapid.privateKey,
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64UrlEncode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub }));
  const signingInput = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      encoder.encode(signingInput),
    ),
  );
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export async function encryptWebPushPayload(
  subscription: WebPushSubscriptionInput,
  payloadString: string,
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const asKeyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;

  const asPublicBytes = new Uint8Array(
    (await crypto.subtle.exportKey('raw', asKeyPair.publicKey)) as ArrayBuffer,
  );

  const deriveParams: Parameters<SubtleCrypto['deriveBits']>[0] = {
    name: 'ECDH',
    public: uaPublicKey,
  } as Parameters<SubtleCrypto['deriveBits']>[0];
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      deriveParams,
      asKeyPair.privateKey,
      256,
    ),
  );

  const prkKey = await hmacSha256(authSecret, sharedSecret);
  const keyInfo = concatBytes(
    encoder.encode('WebPush: info\0'),
    uaPublicBytes,
    asPublicBytes,
  );
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);

  const paddedPlaintext = concatBytes(encoder.encode(payloadString), new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      paddedPlaintext,
    ),
  );

  const header = new Uint8Array(21 + asPublicBytes.length);
  header.set(salt, 0);
  const view = new DataView(header.buffer);
  view.setUint32(16, 4096, false);
  header[20] = asPublicBytes.length;
  header.set(asPublicBytes, 21);

  return concatBytes(header, ciphertext);
}

export async function sendWebPushNotification(
  subscription: WebPushSubscriptionInput,
  payloadString: string,
  vapid: VapidConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; ok: boolean }> {
  const jwt = await createVapidJwt(subscription.endpoint, vapid);
  const body = await encryptWebPushPayload(subscription, payloadString);

  const response = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: body as BodyInit,
  });

  return { status: response.status, ok: response.ok };
}
