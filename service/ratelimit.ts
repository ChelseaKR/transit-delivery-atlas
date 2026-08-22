/**
 * Cost controls: a per-client token bucket, a per-client daily cap, and a hard
 * global daily cap. All in memory; a restart resets them, which is acceptable
 * for a single small instance and documented in docs/AI-SERVICE.md.
 *
 * Nothing here stores anything about a request except a count against a key.
 */

export interface RateLimitConfig {
  ratePerMinute: number;
  clientDailyCap: number;
  dailyCap: number;
}

export interface RateDecision {
  allowed: boolean;
  reason?: "client-rate" | "client-daily" | "global-daily";
  retryAfterSeconds?: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
  dailyCount: number;
  dailyKey: string;
}

const MINUTE = 60_000;

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export class RateLimiter {
  #config: RateLimitConfig;
  #buckets = new Map<string, Bucket>();
  #globalDay = "";
  #globalCount = 0;

  constructor(config: RateLimitConfig) {
    if (config.ratePerMinute <= 0 || config.clientDailyCap <= 0 || config.dailyCap <= 0) {
      throw new Error("Rate limits must be positive.");
    }
    this.#config = config;
  }

  /** Decide, and if allowed, record the request. */
  take(clientKey: string, now: number = Date.now()): RateDecision {
    const today = dayKey(now);
    if (this.#globalDay !== today) {
      this.#globalDay = today;
      this.#globalCount = 0;
      this.#buckets.clear();
    }
    if (this.#globalCount >= this.#config.dailyCap) {
      return { allowed: false, reason: "global-daily", retryAfterSeconds: secondsUntilTomorrow(now) };
    }

    let bucket = this.#buckets.get(clientKey);
    if (!bucket || bucket.dailyKey !== today) {
      bucket = { tokens: this.#config.ratePerMinute, updatedAt: now, dailyCount: 0, dailyKey: today };
      this.#buckets.set(clientKey, bucket);
    }
    const refill = ((now - bucket.updatedAt) / MINUTE) * this.#config.ratePerMinute;
    bucket.tokens = Math.min(this.#config.ratePerMinute, bucket.tokens + refill);
    bucket.updatedAt = now;

    if (bucket.dailyCount >= this.#config.clientDailyCap) {
      return { allowed: false, reason: "client-daily", retryAfterSeconds: secondsUntilTomorrow(now) };
    }
    if (bucket.tokens < 1) {
      const deficit = 1 - bucket.tokens;
      return {
        allowed: false,
        reason: "client-rate",
        retryAfterSeconds: Math.max(1, Math.ceil((deficit / this.#config.ratePerMinute) * 60)),
      };
    }
    bucket.tokens -= 1;
    bucket.dailyCount += 1;
    this.#globalCount += 1;
    return { allowed: true };
  }

  /** Counts only; never identities. */
  snapshot(): { day: string; requestsToday: number; clientsToday: number } {
    return { day: this.#globalDay, requestsToday: this.#globalCount, clientsToday: this.#buckets.size };
  }
}

function secondsUntilTomorrow(now: number): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}
