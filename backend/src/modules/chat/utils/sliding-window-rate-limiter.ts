/**
 * In-memory sliding-window rate limiter: at most `limit` hits per `windowMs`
 * for a given key (socket id, user id...).
 *
 * Single-instance only: with several backend replicas, use a shared store
 * (e.g. Redis) instead.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 50_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Records a hit and returns true, or returns false if the key is over the limit. */
  tryConsume(key: string): boolean {
    const now = this.now();
    const windowStart = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }

    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      this.prune(windowStart);
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  get trackedKeys(): number {
    return this.hits.size;
  }

  // Drops keys without hits in the current window (bounds memory usage)
  private prune(windowStart: number): void {
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((t) => t <= windowStart)) {
        this.hits.delete(key);
      }
    }
  }
}
