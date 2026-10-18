import { describe, expect, it } from 'vitest';
import {
  REDACTED_VALUE,
  isSensitiveKey,
  redactText,
  redactValue,
  sanitizeUrl,
} from '../../src/utils/redact';

describe('isSensitiveKey', () => {
  it.each([
    'Authorization',
    'cookie',
    'set-cookie',
    'access_token',
    'client_secret',
    'apiKey',
    'password',
    'code',
    'state',
    'sessionToken',
    'session',
  ])('flags %s', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['sessionId', 'statusCode', 'errorCode', 'status', 'path'])('allows %s', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('masks sensitive query values and keeps others', () => {
    const result = sanitizeUrl('/api/callback?code=abc&redirect=%2Fbooks&token=t');
    const query = new URLSearchParams(result.split('?')[1]);
    expect(result.startsWith('/api/callback?')).toBe(true);
    expect(query.get('code')).toBe(REDACTED_VALUE);
    expect(query.get('token')).toBe(REDACTED_VALUE);
    expect(query.get('redirect')).toBe('/books');
  });

  it('leaves urls without a query unchanged', () => {
    expect(sanitizeUrl('/api/books')).toBe('/api/books');
  });
});

describe('redactText', () => {
  it('masks bearer tokens', () => {
    expect(redactText('Bearer abc.def')).toBe('Bearer ********');
  });

  it('masks JWT-shaped strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
    const result = redactText(`token was ${jwt} here`);
    expect(result).not.toContain('eyJ');
    expect(result).toContain(REDACTED_VALUE);
  });

  it('replaces email addresses', () => {
    expect(redactText('user a@b.com failed')).toBe('user [email] failed');
  });

  it('masks sensitive query params in free text', () => {
    const result = redactText('see /x?code=1&state=2&ok=yes');
    expect(result).toBe(`see /x?code=${REDACTED_VALUE}&state=${REDACTED_VALUE}&ok=yes`);
  });
});

describe('redactValue', () => {
  it('masks sensitive keys at any depth and redacts strings', () => {
    const input = {
      a: { password: 'p', list: [{ apiKey: 'k', note: 'mail a@b.com' }] },
      status: 'ok',
    };
    expect(redactValue(input)).toEqual({
      a: { password: REDACTED_VALUE, list: [{ apiKey: REDACTED_VALUE, note: 'mail [email]' }] },
      status: 'ok',
    });
  });

  it('does not mutate the input', () => {
    const input = { nested: { token: 'secret', text: 'a@b.com' } };
    const copy = JSON.parse(JSON.stringify(input));
    const result = redactValue(input);
    expect(input).toEqual(copy);
    expect(result).not.toBe(input);
    expect(result.nested).not.toBe(input.nested);
  });

  it('survives circular references', () => {
    const input: any = { name: 'x' };
    input.self = input;
    const result: any = redactValue(input);
    expect(result.name).toBe('x');
    expect(result.self).toBe('[Circular]');
  });

  it('stops at depth 6', () => {
    const input = { l1: { l2: { l3: { l4: { l5: { l6: { l7: 'deep' } } } } } } };
    const result: any = redactValue(input);
    expect(result.l1.l2.l3.l4.l5.l6).toBe('[Truncated]');
  });

  it('passes through primitives and handles errors', () => {
    expect(redactValue(5)).toBe(5);
    expect(redactValue(null)).toBeNull();
    expect(redactValue('Bearer abc')).toBe('Bearer ********');
  });
});
