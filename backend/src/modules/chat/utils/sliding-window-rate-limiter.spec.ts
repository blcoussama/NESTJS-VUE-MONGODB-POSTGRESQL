import { SlidingWindowRateLimiter } from './sliding-window-rate-limiter';

describe('SlidingWindowRateLimiter', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  it('allows `limit` hits in the window, then blocks', () => {
    const limiter = new SlidingWindowRateLimiter(3, 10_000, 100, clock);

    expect([1, 2, 3, 4].map(() => limiter.tryConsume('a'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('slides: a hit becomes available once the oldest one leaves the window', () => {
    const limiter = new SlidingWindowRateLimiter(2, 10_000, 100, clock);
    limiter.tryConsume('a'); // t = 0
    now += 5_000;
    limiter.tryConsume('a'); // t = 5 s
    expect(limiter.tryConsume('a')).toBe(false);

    now += 5_001; // first hit is now older than 10 s
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
  });

  it('keeps independent budgets per key and reset() clears one key', () => {
    const limiter = new SlidingWindowRateLimiter(1, 10_000, 100, clock);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);

    limiter.reset('a');
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(false);
  });

  it('prunes idle keys when the key limit is reached (bounded memory)', () => {
    const limiter = new SlidingWindowRateLimiter(1, 10_000, 2, clock);
    limiter.tryConsume('a');
    limiter.tryConsume('b');
    now += 10_001;

    limiter.tryConsume('c');

    expect(limiter.trackedKeys).toBe(1);
  });
});
