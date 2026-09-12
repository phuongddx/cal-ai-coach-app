/**
 * RFC 4122 v4 identifier generation.
 *
 * Prefers the platform crypto provider when present. The deterministic-random
 * fallback keeps tests and non-crypto runtimes working; Plan 01-04 (sync
 * transport) owns introducing expo-crypto for guaranteed CSPRNG on device —
 * op ids are transport-unique, not security-boundary secrets.
 */
export function newId(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  // dev fallback — replaceable hex digits in v4 shape
  const hex = '0123456789abcdef';
  const digits = '89ab';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += digits[Math.floor(Math.random() * 4)];
    } else {
      out += hex[Math.floor(Math.random() * 16)];
    }
  }
  return out;
}
