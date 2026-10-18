import logger from './logger';
import { logDateKey } from './logRetention';

export const DEFAULT_CLIENT_LOG_DAILY_LIMIT = 20000;

const LIMIT_PATTERN = /^\d+$/;

/** CLIENT_LOG_DAILY_LIMIT: a positive integer; anything else gives the default. */
export function parseClientLogDailyLimit(value: string | undefined): number {
  const trimmed = (value ?? '').trim();
  if (LIMIT_PATTERN.test(trimmed)) {
    const limit = Number(trimmed);
    if (Number.isSafeInteger(limit) && limit > 0) {
      return limit;
    }
  }
  return DEFAULT_CLIENT_LOG_DAILY_LIMIT;
}

export interface ClientLogBudgetOptions {
  limit: number;
  now?: () => Date;
}

/**
 * In-memory count of browser log entries accepted per local day, a ceiling on
 * how much the public endpoint can write to disk.
 */
export class ClientLogBudget {
  private readonly limit: number;
  private readonly now: () => Date;
  private dayKey = '';
  private used = 0;
  private warnedKey = '';

  constructor({ limit, now = () => new Date() }: ClientLogBudgetOptions) {
    this.limit = limit;
    this.now = now;
  }

  remaining(): number {
    this.rollDay();
    return this.limit - this.used;
  }

  /** Takes `count` entries from today's budget, or none if they do not all fit. */
  tryConsume(count: number): boolean {
    this.rollDay();
    if (this.used + count <= this.limit) {
      this.used += count;
      return true;
    }
    if (this.warnedKey !== this.dayKey) {
      this.warnedKey = this.dayKey;
      logger.warn('The browser log budget for the day was exhausted; entries over the limit are refused', {
        event: 'clientlog.budget_exhausted',
        details: { limit: this.limit }
      });
    }
    return false;
  }

  private rollDay(): void {
    const key = logDateKey(this.now());
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.used = 0;
    }
  }
}
