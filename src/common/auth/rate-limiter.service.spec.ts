import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  const originalEnv = { ...process.env };

  const create = (env: Record<string, string> = {}) => {
    process.env = { ...originalEnv };
    delete process.env.SELAH_RATE_LIMIT_PER_MINUTE;
    delete process.env.SELAH_RATE_LIMITS;
    Object.assign(process.env, env);
    return new RateLimiterService();
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses 60 requests per minute by default', () => {
    expect(create().limitFor('LumenBack')).toBe(60);
  });

  it('allows a burst up to the limit and then blocks with a retry hint', () => {
    const limiter = create();
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      expect(limiter.consume('app:A', 3, now).allowed).toBe(true);
    }
    const blocked = limiter.consume('app:A', 3, now);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(20);
  });

  it('refills tokens as time passes', () => {
    const limiter = create();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) limiter.consume('app:A', 3, now);
    expect(limiter.consume('app:A', 3, now).allowed).toBe(false);

    expect(limiter.consume('app:A', 3, now + 20_000).allowed).toBe(true);
    expect(limiter.consume('app:A', 3, now + 20_000).allowed).toBe(false);
  });

  it('never refills beyond the limit after a long idle period', () => {
    const limiter = create();
    const now = 1_000_000;
    limiter.consume('app:A', 2, now);

    const later = now + 60 * 60_000;
    expect(limiter.consume('app:A', 2, later).allowed).toBe(true);
    expect(limiter.consume('app:A', 2, later).allowed).toBe(true);
    expect(limiter.consume('app:A', 2, later).allowed).toBe(false);
  });

  it('keeps a separate bucket per caller', () => {
    const limiter = create();
    const now = 1_000_000;
    limiter.consume('app:A', 1, now);

    expect(limiter.consume('app:A', 1, now).allowed).toBe(false);
    expect(limiter.consume('app:B', 1, now).allowed).toBe(true);
  });

  it('supports per-app limits and a limit of 0 to disable', () => {
    const limiter = create({
      SELAH_RATE_LIMIT_PER_MINUTE: '30',
      SELAH_RATE_LIMITS: 'LumenBack:120,PraiseAppBack:0',
    });

    expect(limiter.limitFor('LumenBack')).toBe(120);
    expect(limiter.limitFor('OutroApp')).toBe(30);
    expect(limiter.limitFor(undefined)).toBe(30);
    expect(limiter.limitFor('PraiseAppBack')).toBe(0);
    expect(limiter.consume('app:PraiseAppBack', 0).allowed).toBe(true);
  });

  it('fails at boot on invalid configuration', () => {
    expect(() => create({ SELAH_RATE_LIMIT_PER_MINUTE: 'muitos' })).toThrow(
      'SELAH_RATE_LIMIT_PER_MINUTE',
    );
    expect(() => create({ SELAH_RATE_LIMITS: 'LumenBack' })).toThrow(
      'SELAH_RATE_LIMITS',
    );
    expect(() => create({ SELAH_RATE_LIMITS: 'LumenBack:-5' })).toThrow();
  });
});
