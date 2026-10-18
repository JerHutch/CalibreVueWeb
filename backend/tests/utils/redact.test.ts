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

  it('masks emails in query and path', () => {
    expect(sanitizeUrl('/a?email=a@b.com')).not.toContain('a@b.com');
    expect(sanitizeUrl('/users/a@b.com')).toBe('/users/[email]');
    expect(sanitizeUrl('/a?e=a%40b.com')).not.toContain('b.com');
  });

  it('masks encoded sensitive keys', () => {
    expect(sanitizeUrl('/a?%63ode=abc')).not.toContain('abc');
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

describe('redactText hardening', () => {
  it('is fast on large inputs without @', () => {
    const start = performance.now();
    redactText('a'.repeat(200000));
    redactText('a.'.repeat(100000));
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('caps output length', () => {
    expect(redactText('a'.repeat(200000)).length).toBeLessThan(5000);
  });

  it('masks url-encoded emails', () => {
    expect(redactText('mail a%40b.com sent')).toBe('mail [email] sent');
  });

  it('masks encoded sensitive query keys', () => {
    expect(redactText('/x?%63ode=abc&ok=1')).toBe(`/x?%63ode=${REDACTED_VALUE}&ok=1`);
  });

  it('masks sensitive name=value pairs in prose', () => {
    expect(redactText('password=hunter2 access_token=abc')).toBe(
      `password=${REDACTED_VALUE} access_token=${REDACTED_VALUE}`
    );
  });

  it('leaves bare code and state pairs alone in prose', () => {
    expect(redactText('code=5 state=ok')).toBe('code=5 state=ok');
  });

  it('masks Google access tokens in free text', () => {
    expect(redactText('got ya29.a0AfH6SM-bc_d.ef42 back')).toBe(`got ${REDACTED_VALUE} back`);
    expect(redactText('/x?t=ya29.abc&ok=1')).not.toContain('ya29');
  });

  it('masks Google refresh tokens in free text', () => {
    expect(redactText('refresh 1//0gAbC-d_E12 stored')).toBe(`refresh ${REDACTED_VALUE} stored`);
  });

  it('leaves look-alikes that are not Google tokens alone', () => {
    expect(redactText('http://host/a1//b and ya29 and 1// end')).toBe(
      'http://host/a1//b and ya29 and 1// end'
    );
  });

  it('stays fast on long runs of Google token prefixes', () => {
    const start = performance.now();
    redactText('ya29.'.repeat(1000));
    redactText('1//'.repeat(1500));
    redactText(`ya29.${'a'.repeat(200000)}`);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('does not leak a Google token cut at the length cap', () => {
    const token = `ya29.${'A'.repeat(100)}`;
    const text = `${'a '.repeat(2040)}${token} tail`;
    const result = redactText(text);
    expect(result).not.toMatch(/ya29|AAAA/);
    expect(result.endsWith('[Truncated]')).toBe(true);
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

  it('passes through primitives', () => {
    expect(redactValue(5)).toBe(5);
    expect(redactValue(null)).toBeNull();
    expect(redactValue('Bearer abc')).toBe('Bearer ********');
  });

  it('redacts error message and stack', () => {
    const error = new Error('failed for a@b.com with Bearer abc123');
    const result: any = redactValue(error);
    expect(result.message).toBe('failed for [email] with Bearer ********');
    expect(result.stack).not.toContain('a@b.com');
    expect(result.stack).not.toContain('abc123');
  });

  it('never throws on throwing getters', () => {
    const input = {
      ok: 1,
      get bad(): string {
        throw new Error('boom');
      },
    };
    const result: any = redactValue(input);
    expect(result.ok).toBe(1);
    expect(result.bad).toBe('[Unserializable]');
  });

  it('never throws on throwing proxies', () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error('boom');
      },
    });
    expect(redactValue({ p: proxy })).toEqual({ p: '[Unserializable]' });
    expect(redactValue(proxy)).toBe('[Unserializable]');
  });

  it('limits keys and items', () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i < 500; i++) obj[`k${i}`] = i;
    expect(Object.keys(redactValue(obj)).length).toBe(101);
    const arr: any = redactValue(new Array(500).fill(1));
    expect(arr.length).toBe(101);
    expect(arr[100]).toBe('[+400 more items]');
  });

  it.each([
    ['email', 'reader@example.com'],
    ['bearer token', 'Bearer abcdef1234567890abcdef'],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InJlYWRlciJ9.c2lnbmF0dXJlMTIz']
  ])('leaves no partial %s when the cap cuts through it', (_name, secret) => {
    for (const offset of [3, 8, 14, 20]) {
      const prefix = `${'a '.repeat(2100).slice(0, 4096 - offset - 1)} `;
      const text = `${prefix}${secret} tail`;
      const result = redactText(text);
      expect(result.endsWith('[Truncated]')).toBe(true);
      expect(result).not.toMatch(/reader|example|abcdef|eyJ|c2lnbm/);
    }
  });

  it('caps long strings', () => {
    const result = redactValue('x'.repeat(100000));
    expect(result.length).toBeLessThan(5000);
    expect(result.endsWith('[Truncated]')).toBe(true);
  });

  it('turns buffers and typed arrays into placeholders', () => {
    expect(redactValue(Buffer.alloc(100000))).toBe('[Buffer 100000 bytes]');
    expect(redactValue(new Uint8Array(10))).toBe('[Uint8Array 10 bytes]');
    expect(redactValue(new ArrayBuffer(8))).toBe('[ArrayBuffer 8 bytes]');
  });

  it('serializes dates, maps and sets', () => {
    expect(redactValue(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(redactValue(new Date('nope'))).toBe('Invalid Date');
    expect(redactValue(new Map([['a', 1]]))).toBe('[Map size 1]');
    expect(redactValue(new Set([1, 2]))).toBe('[Set size 2]');
    expect(redactValue({ at: new Date(0) })).toEqual({ at: '1970-01-01T00:00:00.000Z' });
  });

  it('handles nested string arrays, sessionId and non-sensitive object keys', () => {
    const result: any = redactValue({
      sessionId: 'abcd1234',
      info: { list: ['a@b.com', ['Bearer xyz']] },
      Authorization: 'x',
      AUTHORIZATION: 'y',
    });
    expect(result.sessionId).toBe('abcd1234');
    expect(result.info).toEqual({ list: ['[email]', ['Bearer ********']] });
    expect(result.Authorization).toBe(REDACTED_VALUE);
    expect(result.AUTHORIZATION).toBe(REDACTED_VALUE);
  });
});
