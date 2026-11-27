import { createHmac, timingSafeEqual } from 'node:crypto';

/** A signature older (or newer) than this many seconds is rejected, which bounds replay. */
export const SIGNATURE_MAX_AGE_SECONDS = 300;

const SIGNATURE_HEADER_PATTERN = /^t=(\d+),v1=([0-9a-f]{64})$/;

/** Constant-time comparison of two hex strings; different lengths never match. */
export function timingSafeHexEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies `X-RevenueCat-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`
 * over the exact raw body bytes. `now` is a test seam (default: the clock).
 */
export function verifyRcHmac(
  raw: string,
  header: string,
  secret: string | Buffer,
  now: () => number = Date.now,
): boolean {
  const match = SIGNATURE_HEADER_PATTERN.exec(header);
  if (!match) return false;
  const [timestamp, v1] = [match[1]!, match[2]!];
  const ageSeconds = Math.abs(now() / 1000 - Number(timestamp));
  if (ageSeconds > SIGNATURE_MAX_AGE_SECONDS) return false;
  const digest = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return timingSafeHexEqual(digest, v1);
}
