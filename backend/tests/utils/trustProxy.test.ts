import { describe, expect, it } from 'vitest';
import { resolveTrustProxy } from '../../src/utils/trustProxy';

const HTTPS = 'https://books.example.com';
const HTTP = 'http://localhost:8888';

describe('resolveTrustProxy', () => {
  it('uses a valid TRUST_PROXY_HOPS value', () => {
    expect(resolveTrustProxy('2', HTTPS)).toBe(2);
    expect(resolveTrustProxy('2', HTTP)).toBe(2);
    expect(resolveTrustProxy(' 3 ', HTTP)).toBe(3);
  });

  it('treats 0 as do not trust', () => {
    expect(resolveTrustProxy('0', HTTPS)).toBe(0);
  });

  it('keeps the old default when unset or empty', () => {
    expect(resolveTrustProxy(undefined, HTTPS)).toBe(1);
    expect(resolveTrustProxy(undefined, HTTP)).toBeUndefined();
    expect(resolveTrustProxy('', HTTPS)).toBe(1);
    expect(resolveTrustProxy('', HTTP)).toBeUndefined();
  });

  it.each(['-1', '1.5', '2hops', 'two', 'true', '1e2', '99999999999999999999'])(
    'ignores the invalid value %s',
    (value) => {
      expect(resolveTrustProxy(value, HTTPS)).toBe(1);
      expect(resolveTrustProxy(value, HTTP)).toBeUndefined();
    }
  );
});
