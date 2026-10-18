import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimiter';

const call = (limiter: ReturnType<typeof createRateLimiter>, ip: string | undefined) => {
  const json = vi.fn();
  const res: any = { status: vi.fn(() => res), json };
  const next = vi.fn();
  limiter({ ip } as any, res, next);
  return { res, json, next };
};

describe('createRateLimiter', () => {
  it('allows max requests per window then responds 429', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3, now: () => 1000 });

    for (let i = 0; i < 3; i += 1) {
      expect(call(limiter, '1.1.1.1').next).toHaveBeenCalledOnce();
    }
    const blocked = call(limiter, '1.1.1.1');
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith({ error: 'Too many requests' });
  });

  it('tracks clients separately and resets after the window', () => {
    let time = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => time });

    expect(call(limiter, 'a').next).toHaveBeenCalledOnce();
    expect(call(limiter, 'a').next).not.toHaveBeenCalled();
    expect(call(limiter, 'b').next).toHaveBeenCalledOnce();

    time = 1000;
    expect(call(limiter, 'a').next).toHaveBeenCalledOnce();
  });

  it('uses a shared bucket when the ip is unknown', () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });
    expect(call(limiter, undefined).next).toHaveBeenCalledOnce();
    expect(call(limiter, undefined).next).not.toHaveBeenCalled();
  });

  it('keeps tracking bounded', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1, now: () => 0 });
    for (let i = 0; i < 10005; i += 1) {
      call(limiter, `ip-${i}`);
    }
    // The oldest key was evicted, so it is allowed again.
    expect(call(limiter, 'ip-0').next).toHaveBeenCalledOnce();
  });
});
