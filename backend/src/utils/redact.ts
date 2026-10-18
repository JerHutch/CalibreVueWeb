export const REDACTED_VALUE = '********';

const MAX_DEPTH = 6;

export function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'sessionid') {
    return false;
  }

  return (
    normalizedKey === 'authorization' ||
    normalizedKey === 'cookie' ||
    normalizedKey === 'set-cookie' ||
    normalizedKey === 'password' ||
    normalizedKey === 'code' ||
    normalizedKey === 'state' ||
    normalizedKey.includes('token') ||
    normalizedKey.includes('secret') ||
    normalizedKey.includes('key') ||
    normalizedKey.includes('session')
  );
}

export function sanitizeUrl(url: string): string {
  const queryIndex = url.indexOf('?');

  if (queryIndex === -1) {
    return redactText(url);
  }

  const path = url.slice(0, queryIndex);
  const queryString = url.slice(queryIndex + 1);

  if (!queryString) {
    return redactText(path);
  }

  const queryParams = new URLSearchParams(queryString);
  const sensitiveKeys = Array.from(new Set(queryParams.keys())).filter(isSensitiveKey);

  for (const key of sensitiveKeys) {
    queryParams.set(key, REDACTED_VALUE);
  }

  const sanitizedQuery = queryParams.toString();

  return redactText(sanitizedQuery ? `${path}?${sanitizedQuery}` : path);
}

const MAX_TEXT_LENGTH = 4096;
const MAX_ENTRIES = 100;
const UNSERIALIZABLE = '[Unserializable]';

const BEARER_PATTERN = /\bBearer\s+[^\s,;"']+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]{1,64}(?:@|%40)[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}/gi;
const QUERY_PARAM_PATTERN = /([?&])([^=&\s#]+)=([^&\s#]*)/g;
const PAIR_PATTERN = /\b([A-Za-z0-9_.-]{1,64})=([^\s&,;"']+)/g;

function decodeKey(name: string): string {
  try {
    return decodeURIComponent(name.replace(/\+/g, ' '));
  } catch {
    return name;
  }
}

export function redactText(text: string): string {
  let input = text;

  if (input.length > MAX_TEXT_LENGTH) {
    input = `${input.slice(0, MAX_TEXT_LENGTH)}[Truncated]`;
  }

  return input
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(EMAIL_PATTERN, '[email]')
    .replace(QUERY_PARAM_PATTERN, (match, separator: string, name: string) =>
      isSensitiveKey(decodeKey(name)) ? `${separator}${name}=${REDACTED_VALUE}` : match
    )
    .replace(PAIR_PATTERN, (match, name: string) => {
      const lower = name.toLowerCase();
      if (lower === 'code' || lower === 'state') {
        return match;
      }
      return isSensitiveKey(name) ? `${name}=${REDACTED_VALUE}` : match;
    });
}

function describeBinary(value: object): string | undefined {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }
  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor.name} ${value.byteLength} bytes]`;
  }
  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer ${value.byteLength} bytes]`;
  }
  return undefined;
}

function redactInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  try {
    if (typeof value === 'string') {
      return redactText(value);
    }

    if (value === null || typeof value !== 'object') {
      return value;
    }

    const binary = describeBinary(value);
    if (binary) {
      return binary;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    }

    if (value instanceof Map) {
      return `[Map size ${value.size}]`;
    }

    if (value instanceof Set) {
      return `[Set size ${value.size}]`;
    }

    if (seen.has(value)) {
      return '[Circular]';
    }

    if (depth >= MAX_DEPTH) {
      return '[Truncated]';
    }

    seen.add(value);

    try {
      if (Array.isArray(value)) {
        const items = value
          .slice(0, MAX_ENTRIES)
          .map((item) => redactInner(item, depth + 1, seen));
        if (value.length > MAX_ENTRIES) {
          items.push(`[+${value.length - MAX_ENTRIES} more items]`);
        }
        return items;
      }

      if (value instanceof Error) {
        return {
          name: redactText(String(value.name)),
          message: redactText(String(value.message)),
          stack: value.stack ? redactText(String(value.stack)) : undefined,
        };
      }

      const keys = Object.keys(value);
      const copy: Record<string, unknown> = {};
      for (const key of keys.slice(0, MAX_ENTRIES)) {
        if (isSensitiveKey(key)) {
          copy[redactText(key)] = REDACTED_VALUE;
          continue;
        }
        let child: unknown;
        try {
          child = (value as Record<string, unknown>)[key];
        } catch {
          copy[redactText(key)] = UNSERIALIZABLE;
          continue;
        }
        copy[redactText(key)] = redactInner(child, depth + 1, seen);
      }
      if (keys.length > MAX_ENTRIES) {
        copy['[truncated]'] = `+${keys.length - MAX_ENTRIES} more keys`;
      }
      return copy;
    } finally {
      seen.delete(value);
    }
  } catch {
    return UNSERIALIZABLE;
  }
}

export function redactValue<T>(value: T): T {
  try {
    return redactInner(value, 0, new WeakSet()) as T;
  } catch {
    return UNSERIALIZABLE as unknown as T;
  }
}
