import { RequestHandler } from 'express';
import { redactText } from '../utils/redact';
import logger, { LogLevel } from '../utils/logger';
import { getContext, isValidSessionId } from '../utils/requestContext';
import { ClientLogBudget, parseClientLogDailyLimit } from '../utils/clientLogBudget';

const MAX_ENTRIES = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_EVENT_LENGTH = 64;
const MAX_DETAIL_KEYS = 20;
const MAX_DETAIL_STRING = 200;
const MAX_TS_SKEW_MS = 24 * 60 * 60 * 1000;
const MAX_DETAIL_KEY = 64;
const DETAIL_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
const EVENT_PATTERN = /^[a-z0-9._-]+$/;
const LEVELS: readonly string[] = ['info', 'warn', 'error'];

// Created on first use so CLIENT_LOG_DAILY_LIMIT is read after startup has
// loaded the environment, not when this module is imported.
let budget: ClientLogBudget | null = null;

function getBudget(): ClientLogBudget {
  budget ??= new ClientLogBudget({
    limit: parseClientLogDailyLimit(process.env.CLIENT_LOG_DAILY_LIMIT)
  });
  return budget;
}

/** Test-only: swaps the daily budget and returns the previous one. */
export function setClientLogBudget(next: ClientLogBudget): ClientLogBudget {
  const previous = getBudget();
  budget = next;
  return previous;
}

function sanitizeDetails(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  let count = 0;
  for (const [key, item] of Object.entries(value)) {
    if (count >= MAX_DETAIL_KEYS) break;
    if (key.length > MAX_DETAIL_KEY || !DETAIL_KEY_PATTERN.test(key)) continue;
    if (typeof item === 'string') {
      // Redact before cutting so a secret straddling the cut cannot survive.
      result[key] = redactText(item).slice(0, MAX_DETAIL_STRING);
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      result[key] = item;
    } else if (typeof item === 'boolean') {
      result[key] = item;
    } else {
      continue;
    }
    count += 1;
  }

  return result;
}

function resolveTimestamp(value: unknown, nowMs: number): string {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && Math.abs(parsed - nowMs) <= MAX_TS_SKEW_MS) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(nowMs).toISOString();
}

export const receiveClientLogs: RequestHandler = (req, res) => {
  const body: unknown = req.body;
  const bad = () => res.status(400).json({ error: 'Invalid log payload' });

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    bad();
    return;
  }

  const { sessionId: bodySessionId, entries } = body as Record<string, unknown>;
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) {
    bad();
    return;
  }
  if (bodySessionId !== undefined && !isValidSessionId(bodySessionId)) {
    bad();
    return;
  }

  const nowMs = Date.now();
  const sessionId = (bodySessionId as string | undefined) ?? getContext()?.sessionId;
  const prepared = [];

  for (const raw of entries) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      bad();
      return;
    }
    const { ts, level, event, message, details } = raw as Record<string, unknown>;
    if (typeof level !== 'string' || !LEVELS.includes(level)) {
      bad();
      return;
    }
    if (
      typeof event !== 'string' ||
      event.length > MAX_EVENT_LENGTH ||
      !EVENT_PATTERN.test(event)
    ) {
      bad();
      return;
    }
    if (typeof message !== 'string') {
      bad();
      return;
    }

    const cleanDetails = sanitizeDetails(details);
    prepared.push({
      ts: resolveTimestamp(ts, nowMs),
      level: level as LogLevel,
      source: 'browser' as const,
      ...(sessionId ? { sessionId } : {}),
      event,
      message: redactText(message).slice(0, MAX_MESSAGE_LENGTH),
      ...(cleanDetails ? { details: cleanDetails } : {})
    });
  }

  if (!getBudget().tryConsume(prepared.length)) {
    res.status(429).json({ error: 'Daily log budget exhausted' });
    return;
  }

  for (const entry of prepared) {
    logger.write(entry);
  }

  res.status(204).end();
};
