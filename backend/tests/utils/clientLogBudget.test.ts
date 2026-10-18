import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../src/utils/logger';
import {
  ClientLogBudget,
  DEFAULT_CLIENT_LOG_DAILY_LIMIT,
  parseClientLogDailyLimit
} from '../../src/utils/clientLogBudget';

describe('parseClientLogDailyLimit', () => {
  it('uses a positive integer', () => {
    expect(parseClientLogDailyLimit('500')).toBe(500);
    expect(parseClientLogDailyLimit(' 7 ')).toBe(7);
  });

  it.each([undefined, '', '0', '-5', '1.5', '10k', 'abc', '99999999999999999999'])(
    'falls back to the default for %s',
    (value) => {
      expect(parseClientLogDailyLimit(value)).toBe(DEFAULT_CLIENT_LOG_DAILY_LIMIT);
    }
  );

  it('defaults to 20000 entries', () => {
    expect(DEFAULT_CLIENT_LOG_DAILY_LIMIT).toBe(20000);
  });
});

describe('ClientLogBudget', () => {
  let now: Date;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const clock = () => now;

  beforeEach(() => {
    now = new Date(2026, 9, 18, 10, 0, 0);
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decrements by the entries accepted', () => {
    const budget = new ClientLogBudget({ limit: 10, now: clock });
    expect(budget.tryConsume(4)).toBe(true);
    expect(budget.remaining()).toBe(6);
    expect(budget.tryConsume(6)).toBe(true);
    expect(budget.remaining()).toBe(0);
    expect(budget.tryConsume(0)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects a request that would exceed the remaining budget without consuming it', () => {
    const budget = new ClientLogBudget({ limit: 10, now: clock });
    expect(budget.tryConsume(8)).toBe(true);
    expect(budget.tryConsume(3)).toBe(false);
    expect(budget.remaining()).toBe(2);
    expect(budget.tryConsume(2)).toBe(true);
    expect(budget.tryConsume(1)).toBe(false);
  });

  it('warns once per local day when the budget is hit', () => {
    const budget = new ClientLogBudget({ limit: 2, now: clock });
    budget.tryConsume(2);
    expect(budget.tryConsume(1)).toBe(false);
    expect(budget.tryConsume(1)).toBe(false);
    now = new Date(2026, 9, 18, 23, 59, 0);
    expect(budget.tryConsume(5)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/browser log budget for the day was exhausted/i),
      { event: 'clientlog.budget_exhausted', details: { limit: 2 } }
    );
  });

  it('resets on a new local day and warns again that day', () => {
    const budget = new ClientLogBudget({ limit: 2, now: clock });
    budget.tryConsume(2);
    expect(budget.tryConsume(1)).toBe(false);
    now = new Date(2026, 9, 19, 0, 0, 1);
    expect(budget.remaining()).toBe(2);
    expect(budget.tryConsume(2)).toBe(true);
    expect(budget.tryConsume(1)).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
