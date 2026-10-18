import type { App } from 'vue';
import appConfig from '@/app.config.json';
import { getSessionId, SESSION_HEADER } from '@/logging/sessionId';

export type ClientLogLevel = 'info' | 'warn' | 'error';
export type ClientLogDetails = Record<string, string | number | boolean>;

interface ClientLogEntry {
  ts: string;
  level: ClientLogLevel;
  event: string;
  message: string;
  details: ClientLogDetails;
}

const MAX_BUFFER = 100;
const MAX_ENTRIES_PER_REQUEST = 20;
const MAX_BODY_BYTES = 15000;
const FLUSH_DELAY_MS = 5000;
const DEFAULT_TIMEOUT_MS = 3000;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 500;
const MAX_EVENT_LENGTH = 64;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_DETAIL_VALUE_LENGTH = 200;
const MAX_DETAIL_KEYS = 20;
const LEVELS: ClientLogLevel[] = ['info', 'warn', 'error'];

let queue: ClientLogEntry[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let current: Promise<void> | null = null;
let windowHandlersInstalled = false;
let patchedApps = new WeakSet<object>();
let removeWindowHandlers: (() => void) | null = null;

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 3;
  }
}

function sanitizeEvent(event: unknown): string {
  const cleaned = String(event ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '.')
    .slice(0, MAX_EVENT_LENGTH);
  return cleaned || 'client.log';
}

function sanitizeDetails(details: unknown): ClientLogDetails {
  const result: ClientLogDetails = {};
  if (!details || typeof details !== 'object') {
    return result;
  }
  let count = 0;
  for (const rawKey of Object.keys(details)) {
    if (count >= MAX_DETAIL_KEYS) {
      break;
    }
    const key = rawKey.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
    if (!key) {
      continue;
    }
    const value = (details as Record<string, unknown>)[rawKey];
    if (typeof value === 'string') {
      result[key] = value.slice(0, MAX_DETAIL_VALUE_LENGTH);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === 'boolean') {
      result[key] = value;
    } else {
      continue;
    }
    count += 1;
  }
  return result;
}

function stripUrl(url: unknown): string {
  return String(url ?? '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '')
    .split(/[?#]/)[0];
}

function scheduleFlush(): void {
  if (timer !== null || queue.length === 0) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void flushClientLogs();
  }, FLUSH_DELAY_MS);
}

function buildChunks(entries: ClientLogEntry[], sessionId: string): ClientLogEntry[][] {
  const baseSize = byteLength(JSON.stringify({ sessionId, entries: [] }));
  const chunks: ClientLogEntry[][] = [];
  let chunk: ClientLogEntry[] = [];
  let size = baseSize;
  for (let entry of entries) {
    let entrySize = byteLength(JSON.stringify(entry)) + 1;
    if (baseSize + entrySize > MAX_BODY_BYTES) {
      entry = { ...entry, details: {} };
      entrySize = byteLength(JSON.stringify(entry)) + 1;
      if (baseSize + entrySize > MAX_BODY_BYTES) {
        continue;
      }
    }
    if (chunk.length > 0 && (chunk.length >= MAX_ENTRIES_PER_REQUEST || size + entrySize > MAX_BODY_BYTES)) {
      chunks.push(chunk);
      chunk = [];
      size = baseSize;
    }
    chunk.push(entry);
    size += entrySize;
  }
  if (chunk.length > 0) {
    chunks.push(chunk);
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withDeadline<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      onTimeout();
      reject(new Error('request timed out'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      }
    );
  });
}

async function sendChunk(sessionId: string, entries: ClientLogEntry[], keepalive: boolean): Promise<void> {
  const body = JSON.stringify({ sessionId, entries });
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (typeof fetch !== 'function') {
      return;
    }
    try {
      let controller: AbortController | undefined;
      try {
        controller = typeof AbortController === 'function' ? new AbortController() : undefined;
      } catch {
        controller = undefined;
      }
      const response = await withDeadline(
        fetch(`${appConfig.apiUrl}/client-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            [SESSION_HEADER]: sessionId
          },
          body,
          credentials: 'same-origin',
          keepalive,
          signal: controller?.signal
        }),
        REQUEST_TIMEOUT_MS,
        () => controller?.abort()
      );
      // Anything below 500 is final: success, or our fault (400/413/429).
      if (response.status < 500) {
        return;
      }
    } catch {
      // network error or timeout: retry below
    }
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
}

async function runCycle(keepalive: boolean): Promise<void> {
  const snapshot = queue;
  queue = [];
  try {
    const sessionId = getSessionId();
    for (const chunk of buildChunks(snapshot, sessionId)) {
      await sendChunk(sessionId, chunk, keepalive);
    }
  } catch {
    // never reject
  }
}

function afterCycle(): void {
  current = null;
  if (queue.length >= MAX_ENTRIES_PER_REQUEST) {
    void flushClientLogs();
  } else {
    scheduleFlush();
  }
}

/**
 * Sends everything queued right now. Resolves when sent, failed or after
 * timeoutMs; never rejects. A call while a send is running joins it instead of
 * sending the same entries again.
 */
export function flushClientLogs(
  options: { keepalive?: boolean; timeoutMs?: number } = {}
): Promise<void> {
  try {
    if (!current) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (queue.length === 0) {
        return Promise.resolve();
      }
      const cycle: Promise<void> = runCycle(options.keepalive === true).then(() => {
        if (current === cycle) {
          afterCycle();
        }
      });
      current = cycle;
    }
    const running = current;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return new Promise<void>((resolve) => {
      const id = setTimeout(resolve, timeoutMs);
      running.then(() => {
        clearTimeout(id);
        resolve();
      });
    });
  } catch {
    return Promise.resolve();
  }
}

export function clientLog(
  level: ClientLogLevel,
  event: string,
  message: string,
  details?: ClientLogDetails
): void {
  try {
    queue.push({
      ts: new Date().toISOString(),
      level: LEVELS.includes(level) ? level : 'info',
      event: sanitizeEvent(event),
      message: String(message ?? '').slice(0, MAX_MESSAGE_LENGTH),
      details: sanitizeDetails(details)
    });
    while (queue.length > MAX_BUFFER) {
      queue.shift();
    }
    if (queue.length >= MAX_ENTRIES_PER_REQUEST) {
      void flushClientLogs();
    } else {
      scheduleFlush();
    }
  } catch {
    // logging must never throw into callers
  }
}

export function describeError(error: unknown): ClientLogDetails {
  try {
    if (error && typeof error === 'object') {
      const err = error as Record<string, any>;
      if (err.isAxiosError || err.config) {
        const result: ClientLogDetails = {
          name: String(err.name ?? 'AxiosError').slice(0, 100)
        };
        if (typeof err.code === 'string') {
          result.code = err.code.slice(0, 100);
        }
        const responseStatus = err.response?.status;
        if (typeof responseStatus === 'number' && Number.isFinite(responseStatus)) {
          result.status = responseStatus;
        }
        if (typeof err.config?.method === 'string') {
          result.method = err.config.method.toUpperCase();
        }
        if (typeof err.config?.url === 'string') {
          result.path = stripUrl(err.config.url).slice(0, 200);
        }
        return result;
      }
      if (error instanceof Error) {
        return {
          name: String(error.name).slice(0, 100),
          message: String(error.message).slice(0, 200)
        };
      }
    }
    return { value: String(error).slice(0, 200) };
  } catch {
    return { value: '[unprintable]' };
  }
}

function flushOnPageHide(): void {
  void flushClientLogs({ keepalive: true });
}

function flushWhenHidden(): void {
  if (document.visibilityState === 'hidden') {
    void flushClientLogs({ keepalive: true });
  }
}

function installWindowHandlers(): void {
  const onError = (event: Event): void => {
    try {
      const e = event as ErrorEvent;
      const details: ClientLogDetails = {
        message: String(e.message ?? '').slice(0, 200)
      };
      if (e.filename) {
        details.filename = stripUrl(e.filename).slice(0, 200);
      }
      if (typeof e.lineno === 'number') {
        details.lineno = e.lineno;
      }
      if (typeof e.colno === 'number') {
        details.colno = e.colno;
      }
      clientLog('error', 'window.error', details.message as string || 'window error', details);
    } catch {
      // ignore
    }
  };
  const onRejection = (event: Event): void => {
    try {
      clientLog(
        'error',
        'window.unhandledrejection',
        'Unhandled promise rejection',
        describeError((event as PromiseRejectionEvent).reason)
      );
    } catch {
      // ignore
    }
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('pagehide', flushOnPageHide);
  document.addEventListener('visibilitychange', flushWhenHidden);
  removeWindowHandlers = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('pagehide', flushOnPageHide);
    document.removeEventListener('visibilitychange', flushWhenHidden);
  };
}

export function installGlobalErrorHandlers(app: App): void {
  try {
    if (!windowHandlersInstalled) {
      installWindowHandlers();
      windowHandlersInstalled = true;
    }
    if (!patchedApps.has(app)) {
      patchedApps.add(app);
      const previous = app.config.errorHandler;
      app.config.errorHandler = (err, instance, info) => {
        try {
          clientLog('error', 'vue.error', 'Vue error', {
            ...describeError(err),
            info: String(info ?? '').slice(0, 100)
          });
        } catch {
          // ignore
        }
        if (previous) {
          previous(err, instance, info);
        }
      };
    }
  } catch {
    // never throw into the app bootstrap
  }
}

/** Test-only: clears the queue, timers and installed handlers. */
export function resetClientLogger(): void {
  try {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = null;
    queue = [];
    current = null;
    removeWindowHandlers?.();
    removeWindowHandlers = null;
    windowHandlersInstalled = false;
    patchedApps = new WeakSet<object>();
  } catch {
    // ignore
  }
}
