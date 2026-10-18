import { describe, it, expect } from 'vitest';
import {
  runWithContext,
  getContext,
  isValidSessionId,
  SESSION_HEADER,
  SESSION_COOKIE_NAME
} from '../../src/utils/requestContext';

describe('isValidSessionId', () => {
  it('accepts valid ids', () => {
    expect(isValidSessionId('3f2b8c1e-9d4a-4b7e-8a1c-2d5e6f7a8b9c')).toBe(true);
    expect(isValidSessionId('abcd1234')).toBe(true);
  });

  it('rejects invalid ids', () => {
    expect(isValidSessionId('short')).toBe(false);
    expect(isValidSessionId('a'.repeat(65))).toBe(false);
    expect(isValidSessionId('a b c d e f g h')).toBe(false);
    expect(isValidSessionId('../../etc/passwd')).toBe(false);
    expect(isValidSessionId('abc\n12345678')).toBe(false);
    expect(isValidSessionId(12345678)).toBe(false);
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId(['abcd1234'])).toBe(false);
  });

  it('exposes constants', () => {
    expect(SESSION_HEADER).toBe('x-session-id');
    expect(SESSION_COOKIE_NAME).toBe('client_session_id');
  });
});

describe('request context', () => {
  it('returns undefined outside a context', () => {
    expect(getContext()).toBeUndefined();
  });

  it('survives await, setImmediate and promise hops', async () => {
    await runWithContext({ sessionId: 'abcd1234' }, async () => {
      await Promise.resolve();
      expect(getContext()?.sessionId).toBe('abcd1234');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(getContext()?.sessionId).toBe('abcd1234');
      await new Promise<void>((resolve) => {
        new Promise<void>((inner) => inner()).then(() => {
          expect(getContext()?.sessionId).toBe('abcd1234');
          resolve();
        });
      });
    });
    expect(getContext()).toBeUndefined();
  });
});
