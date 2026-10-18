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
  const [path, queryString] = url.split('?', 2);

  if (!queryString) {
    return path;
  }

  const queryParams = new URLSearchParams(queryString);

  queryParams.forEach((_value, key) => {
    if (isSensitiveKey(key)) {
      queryParams.set(key, REDACTED_VALUE);
    }
  });

  const sanitizedQuery = queryParams.toString();

  return sanitizedQuery ? `${path}?${sanitizedQuery}` : path;
}

const BEARER_PATTERN = /\bBearer\s+[^\s,;"']+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const QUERY_PARAM_PATTERN = /([?&])([^=&\s#]+)=([^&\s#]*)/g;

export function redactText(text: string): string {
  return text
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(EMAIL_PATTERN, '[email]')
    .replace(QUERY_PARAM_PATTERN, (match, separator: string, name: string) =>
      isSensitiveKey(name) ? `${separator}${name}=${REDACTED_VALUE}` : match
    );
}

function redactInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  if (depth >= MAX_DEPTH) {
    return '[Truncated]';
  }

  seen.add(value);

  let result: unknown;

  if (Array.isArray(value)) {
    result = value.map((item) => redactInner(item, depth + 1, seen));
  } else if (value instanceof Error) {
    result = {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
    };
  } else {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      copy[key] = isSensitiveKey(key) ? REDACTED_VALUE : redactInner(child, depth + 1, seen);
    }
    result = copy;
  }

  seen.delete(value);
  return result;
}

export function redactValue<T>(value: T): T {
  return redactInner(value, 0, new WeakSet()) as T;
}
