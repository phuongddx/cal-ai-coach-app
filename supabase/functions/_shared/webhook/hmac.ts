export const SIGNATURE_MAX_AGE_SECONDS = 300;

const SIGNATURE_HEADER_PATTERN = /^t=(\d+),v1=([0-9a-f]{64})$/;

const encoder = new TextEncoder();

export function timingSafeHexEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyRcHmac(raw: string, header: string, secret: string): Promise<boolean> {
  const match = SIGNATURE_HEADER_PATTERN.exec(header);
  if (!match) return false;
  const [timestamp, v1] = [match[1], match[2]];
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > SIGNATURE_MAX_AGE_SECONDS) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${raw}`));
  return timingSafeHexEqual(toHex(digest), v1);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
