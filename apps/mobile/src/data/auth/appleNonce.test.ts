/**
 * The Apple nonce (`AppleNonceProvider` of the Swift app): a single-use raw nonce, SHA-256 hashed
 * through expo-crypto. expo-apple-authentication passes `nonce` through unhashed (its iOS request
 * sets `request.nonce = options.nonce`), so the Apple request must receive the hash and the server
 * the raw value. expo-crypto loads lazily: the native build the Simulator runs predates the package.
 */
import { createHash } from 'crypto';

import { isAuthError } from './types';
import { appleNonceAvailable, makeAppleNonce } from './appleNonce';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

describe('apple nonce', () => {
  it('hashes the raw nonce with sha 256 as lowercase hex', async () => {
    const nonce = await makeAppleNonce();
    expect(nonce.hashed).toBe(sha256Hex(nonce.raw));
    expect(nonce.hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(nonce.raw).not.toBe(nonce.hashed);
  });

  it('raw nonce is 64 hex characters like thirty two random bytes', async () => {
    expect((await makeAppleNonce()).raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it('every nonce is single use', async () => {
    const [first, second] = [await makeAppleNonce(), await makeAppleNonce()];
    expect(first.raw).not.toBe(second.raw);
    expect(first.hashed).not.toBe(second.hashed);
  });

  it('loads expo crypto lazily and not at import time', async () => {
    const load = jest.fn(async () => ({
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async (_algorithm: string, data: string) => sha256Hex(data),
    }));
    expect(load).not.toHaveBeenCalled();
    await makeAppleNonce({ loadCrypto: load });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a build without expo crypto yields a typed error and no apple button', async () => {
    const missing = async () => {
      throw new Error("Cannot find native module 'ExpoCrypto'");
    };

    expect(await appleNonceAvailable({ loadCrypto: missing })).toBe(false);
    const error = await makeAppleNonce({ loadCrypto: missing }).catch((caught: unknown) => caught);
    expect(isAuthError(error)).toBe(true);
    expect(error).toMatchObject({ name: 'AuthError', kind: 'nonceUnavailable' });
  });

  it('a digest that fails is the same typed error', async () => {
    const broken = async () => ({
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async () => {
        throw new Error('native digest failed');
      },
    });
    expect(await appleNonceAvailable({ loadCrypto: broken })).toBe(false);
    await expect(makeAppleNonce({ loadCrypto: broken })).rejects.toMatchObject({ kind: 'nonceUnavailable' });
  });

  it('reports available when the digest works', async () => {
    expect(await appleNonceAvailable()).toBe(true);
  });
});
