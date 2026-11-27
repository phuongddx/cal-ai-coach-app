import { RateLimiter } from './rateLimit';

describe('in-memory rate limiter', () => {
  it('allows the limit then blocks until the window passes', () => {
    let now = 1_000;
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
    expect([1, 2, 3].map(() => limiter.hit('a'))).toEqual([true, true, true]);
    expect(limiter.hit('a')).toBe(false);
    now += 59_999;
    expect(limiter.hit('a')).toBe(false);
    now += 2;
    expect(limiter.hit('a')).toBe(true);
  });

  it('counts each key on its own and forgets idle keys', () => {
    let now = 0;
    const limiter = new RateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    expect(limiter.hit('a')).toBe(true);
    expect(limiter.hit('b')).toBe(true);
    expect(limiter.hit('a')).toBe(false);
    now += 5_000;
    expect(limiter.size()).toBe(2);
    limiter.sweep();
    expect(limiter.size()).toBe(0);
  });
});
