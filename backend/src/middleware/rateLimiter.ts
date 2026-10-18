import { RequestHandler } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  now?: () => number;
}

const MAX_TRACKED_KEYS = 10000;

// Fixed-window, in-memory limiter keyed on req.ip.
// Limitation: behind the reverse proxy and the frontend nginx container, req.ip
// is the nearest proxy's address unless `trust proxy` covers every hop (see
// TRUST_PROXY_HOPS in app.ts), so all clients may share one bucket.
export function createRateLimiter({ windowMs, max, now = Date.now }: RateLimiterOptions): RequestHandler {
  // Map preserves insertion order, so the first key is the oldest bucket.
  const buckets = new Map<string, { windowStart: number; count: number }>();

  return (req, res, next) => {
    const time = now();
    const key = req.ip ?? 'unknown';

    for (const [bucketKey, bucket] of buckets) {
      if (time - bucket.windowStart >= windowMs) {
        buckets.delete(bucketKey);
      } else {
        // Buckets are inserted in window-start order, so the rest are live.
        break;
      }
    }

    let bucket = buckets.get(key);
    if (!bucket) {
      while (buckets.size >= MAX_TRACKED_KEYS) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
      bucket = { windowStart: time, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    next();
  };
}
