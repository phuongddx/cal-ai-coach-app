import {
  decryptSecret,
  deriveKey,
  encryptSecret,
  hashPassword,
  hmacHex,
  randomToken,
  sha256Hex,
  verifyPassword,
} from './crypto';

describe('password hashing (scrypt)', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
  });

  it('salts every hash and rejects a malformed stored hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('same-password', 'scrypt$1$1$1$AAAA$AAAA')).toBe(false);
  });
});

describe('AES-256-GCM secret envelope', () => {
  const key = deriveKey('k'.repeat(40), 'test');

  it('round-trips and never contains the plaintext', () => {
    const sealed = encryptSecret('apple-refresh-token-value', key);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('apple-refresh-token-value');
    expect(decryptSecret(sealed, key)).toBe('apple-refresh-token-value');
    expect(encryptSecret('apple-refresh-token-value', key)).not.toBe(sealed); // fresh IV
  });

  it('fails on a tampered envelope and on another key', () => {
    const sealed = encryptSecret('secret', key);
    const parts = sealed.split('.');
    const flipped = [...parts.slice(0, 3), Buffer.from('tampered').toString('base64url')].join('.');
    expect(() => decryptSecret(flipped, key)).toThrow();
    expect(() => decryptSecret(sealed, deriveKey('j'.repeat(40), 'test'))).toThrow();
    expect(() => decryptSecret('garbage', key)).toThrow();
  });

  it('derives distinct keys per purpose', () => {
    expect(deriveKey('s'.repeat(40), 'a').equals(deriveKey('s'.repeat(40), 'b'))).toBe(false);
    expect(deriveKey('s'.repeat(40), 'a')).toHaveLength(32);
  });
});

describe('hash helpers', () => {
  it('sha256Hex and hmacHex are 64 hex characters and deterministic', () => {
    expect(sha256Hex('x')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('x')).toBe(sha256Hex('x'));
    expect(hmacHex(Buffer.from('k'), 'x')).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacHex(Buffer.from('k'), 'x')).not.toBe(hmacHex(Buffer.from('j'), 'x'));
  });

  it('randomToken is url-safe and unique', () => {
    const a = randomToken(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(a);
  });
});
