/**
 * RFC 4122 version 4 UUID for record ids and operation ids.
 *
 * The API contract uses `z.uuid()`, which checks the version and variant
 * nibbles, so a random-looking string is not enough. Hermes on RN 0.88 has no
 * `crypto.randomUUID`, so the fallback builds a real v4 from 16 random bytes
 * (`crypto.getRandomValues` when present, `Math.random` otherwise).
 */
type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
};

export function newUuid(source: RandomSource | undefined = globalThis.crypto): string {
  if (source?.randomUUID) return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) {
    source.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
