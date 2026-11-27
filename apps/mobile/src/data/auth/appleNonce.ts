/**
 * Single-use Apple nonce (`AppleNonceProvider` of the Swift app). The raw nonce goes to the server,
 * its SHA-256 hex goes on the Apple request: `expo-apple-authentication` passes `nonce` through
 * unhashed, so hashing is this file's job.
 *
 * `expo-crypto` is loaded lazily inside the function: the native build that the Simulator runs today
 * predates that package, and a top-level import would crash the app there. When the hash cannot be
 * computed the error is typed (`nonceUnavailable`) and the sign-in screen hides the Apple button.
 */
import { newUuid } from '../sync/uuid';
import type { AuthError } from './types';

export type AppleNonce = { raw: string; hashed: string };

type CryptoModule = {
  CryptoDigestAlgorithm: { SHA256: string };
  digestStringAsync: (algorithm: any, data: string) => Promise<string>;
};

export type AppleNonceOptions = {
  /** Test seam: how `expo-crypto` is loaded. */
  loadCrypto?: () => Promise<CryptoModule>;
};

// A `require` inside the function, not a top-level import: Metro only evaluates the module when the
// function runs (Jest has no dynamic `import()` without a flag either).
const loadExpoCrypto = async (): Promise<CryptoModule> => require('expo-crypto') as CryptoModule;

function unavailable(cause: unknown): AuthError {
  return {
    name: 'AuthError',
    kind: 'nonceUnavailable',
    message: cause instanceof Error ? cause.message : 'the nonce hash could not be computed',
  };
}

async function sha256Hex(value: string, loadCrypto: () => Promise<CryptoModule>): Promise<string> {
  try {
    const crypto = await loadCrypto();
    return await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256, value);
  } catch (cause) {
    throw unavailable(cause);
  }
}

/** 64 hex characters, the size of 32 random bytes; built from two ids of the one id source. */
function rawNonce(): string {
  return (newUuid() + newUuid()).replace(/-/g, '');
}

export async function makeAppleNonce(options: AppleNonceOptions = {}): Promise<AppleNonce> {
  const raw = rawNonce();
  return { raw, hashed: await sha256Hex(raw, options.loadCrypto ?? loadExpoCrypto) };
}

/** Whether Sign in with Apple can run in this build: true only when the hash can be computed. */
export async function appleNonceAvailable(options: AppleNonceOptions = {}): Promise<boolean> {
  try {
    await sha256Hex('probe', options.loadCrypto ?? loadExpoCrypto);
    return true;
  } catch {
    return false;
  }
}
