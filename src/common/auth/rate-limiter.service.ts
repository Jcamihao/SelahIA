import { Injectable } from '@nestjs/common';

type Bucket = { tokens: number; updatedAt: number };

const DEFAULT_LIMIT_PER_MINUTE = 60;

const readLimit = (raw: string | undefined, fallback: number, label: string) => {
  const text = String(raw ?? '').trim();
  if (!text) {
    return fallback;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} invalido: "${text}" (esperado inteiro >= 0).`);
  }
  return value;
};

@Injectable()
export class RateLimiterService {
  private readonly defaultLimit = readLimit(
    process.env.SELAH_RATE_LIMIT_PER_MINUTE,
    DEFAULT_LIMIT_PER_MINUTE,
    'SELAH_RATE_LIMIT_PER_MINUTE',
  );
  private readonly overrides = new Map<string, number>();
  private readonly buckets = new Map<string, Bucket>();

  constructor() {
    String(process.env.SELAH_RATE_LIMITS || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const separator = entry.lastIndexOf(':');
        const app = separator > 0 ? entry.slice(0, separator).trim() : '';
        if (!app) {
          throw new Error(
            `SELAH_RATE_LIMITS invalido em "${entry}": esperado App:limite.`,
          );
        }
        this.overrides.set(
          app,
          readLimit(entry.slice(separator + 1), 0, `SELAH_RATE_LIMITS (${app})`),
        );
      });
  }

  limitFor(app?: string) {
    const override = app ? this.overrides.get(app) : undefined;
    return override ?? this.defaultLimit;
  }

  // Token bucket: `limit` fichas por minuto, com rajada de ate `limit`. Limite 0 desliga.
  consume(bucketId: string, limit: number, now = Date.now()) {
    if (limit <= 0) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const bucket = this.buckets.get(bucketId) ?? {
      tokens: limit,
      updatedAt: now,
    };
    const refilled = ((now - bucket.updatedAt) / 60_000) * limit;
    bucket.tokens = Math.min(limit, bucket.tokens + refilled);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(bucketId, bucket);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    this.buckets.set(bucketId, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(((1 - bucket.tokens) / limit) * 60),
      ),
    };
  }
}
