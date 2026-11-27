/**
 * RFC 4122 version 4 UUID for record ids, operation ids and the Apple nonce.
 *
 * The API contract uses `z.uuid()`, which checks the version and variant nibbles, so a
 * random-looking string is not enough. Hermes on RN 0.88 has no `globalThis.crypto`, so the 16
 * bytes come from `expo-crypto`'s `getRandomValues` (the platform's secure random source:
 * SecRandomCopyBytes on iOS). There is no weaker fallback: when the secure source cannot be
 * loaded, `newUuid` throws instead of handing out guessable ids, because the Apple nonce is
 * built from two of these ids.
 *
 * `expo-crypto` is loaded lazily, the way `auth/appleNonce.ts` does it: the native build the
 * Simulator runs today may predate the package, and a top-level import would crash the app
 * at start-up rather than at the first id.
 */
export type FillRandomBytes = (bytes: Uint8Array) => unknown;

type ExpoCryptoModule = { getRandomValues: <T extends ArrayBufferView>(typedArray: T) => T };

// A `require` inside the function, not a top-level import: Metro only evaluates the module when
// the function runs.
const loadSecureRandom = (): FillRandomBytes => {
  const mod = require('expo-crypto') as ExpoCryptoModule;
  return (bytes) => mod.getRandomValues(bytes);
};

/**
 * @param fill test seam: how the 16 random bytes are produced. Production code always omits it.
 */
export function newUuid(fill?: FillRandomBytes): string {
  const bytes = new Uint8Array(16);
  (fill ?? loadSecureRandom())(bytes);
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
