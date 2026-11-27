/**
 * Fixed-window counter held in process memory. It protects a single API instance only: a restart
 * resets it and several instances would each count on their own. Documented in
 * docs/rn-migration/parity-detail/backend-auth.md; move to the database before running replicas.
 */
export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  /** Records one attempt; returns false when the key is over its limit for the current window. */
  hit(key: string): boolean {
    const now = this.now();
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  size(): number {
    return this.hits.size;
  }

  sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.hits) if (now >= entry.resetAt) this.hits.delete(key);
  }
}
