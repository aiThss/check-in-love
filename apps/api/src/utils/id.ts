let lastTimestampSec = 0;
let sequenceCounter = 0;

/**
 * Generates a monotonically ordered 24-hex ObjectId-compatible string
 * so cursor comparisons (`id < before` / `id > after`) sort strictly by creation order.
 */
export function generateId(): string {
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > lastTimestampSec) {
    lastTimestampSec = nowSec;
    sequenceCounter = 0;
  } else {
    sequenceCounter = (sequenceCounter + 1) & 0xffffff;
    if (sequenceCounter === 0) {
      lastTimestampSec += 1;
    }
  }

  const tsHex = lastTimestampSec.toString(16).padStart(8, '0').slice(-8);
  const seqHex = sequenceCounter.toString(16).padStart(6, '0');
  const randomBytes = new Uint8Array(5);
  crypto.getRandomValues(randomBytes);
  const randHex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${tsHex}${seqHex}${randHex}`;
}

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(value.trim());
}

export function generateCoupleCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
