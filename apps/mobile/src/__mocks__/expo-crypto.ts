/**
 * Manual Jest mock for `expo-crypto`: a real SHA-256 through Node's `crypto`, so the nonce tests check
 * actual digests. Only the calls the app uses are provided (digestStringAsync, getRandomValues). `loadable` lets a test simulate the native
 * build that predates the package (the module import then throws).
 */
import { createHash, randomFillSync } from 'crypto';

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' } as const;
export const CryptoEncoding = { HEX: 'hex', BASE64: 'base64' } as const;

export const digestStringAsync = jest.fn(
  async (_algorithm: string, data: string, options?: { encoding?: string }): Promise<string> =>
    createHash('sha256')
      .update(data)
      .digest(options?.encoding === 'base64' ? 'base64' : 'hex'),
);

/** The secure random source `newUuid` uses: Node's CSPRNG fills the view in place and returns it. */
export const getRandomValues = jest.fn(<T extends ArrayBufferView>(typedArray: T): T => {
  randomFillSync(typedArray);
  return typedArray;
});
