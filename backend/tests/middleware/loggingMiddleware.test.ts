import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLogger } from '../../src/middleware/loggingMiddleware';
import logger from '../../src/utils/logger';

const run = (reqOverrides: Record<string, unknown> = {}, statusCode = 200) => {
  const finishHandlers: Array<() => void> = [];
  const next = vi.fn();
  const req = {
    method: 'GET',
    originalUrl: '/api/books',
    headers: {},
    body: {},
    ...reqOverrides
  };
  const res = {
    statusCode,
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'finish') {
        finishHandlers.push(handler);
      }
    })
  };

  requestLogger(req as any, res as any, next);

  return { next, finish: () => finishHandlers.forEach(handler => handler()) };
};

describe('requestLogger', () => {
  const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs nothing until the response finishes, then one http.request line', () => {
    const { next, finish } = run({ method: 'POST', originalUrl: '/api/books' }, 201);

    expect(next).toHaveBeenCalledOnce();
    expect(infoSpy).not.toHaveBeenCalled();

    finish();

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('POST /api/books 201', {
      event: 'http.request',
      details: {
        method: 'POST',
        path: '/api/books',
        status: 201,
        durationMs: expect.any(Number)
      }
    });
  });

  it('does not log headers, cookies or bodies', () => {
    const { finish } = run({
      method: 'POST',
      originalUrl: '/api/login',
      headers: {
        authorization: 'Bearer secret-token-value',
        cookie: 'session=cookie-value-123'
      },
      body: { username: 'reader', password: 'plaintext-password' }
    });

    finish();

    const logged = JSON.stringify(infoSpy.mock.calls);
    for (const value of [
      'secret-token-value',
      'cookie-value-123',
      'plaintext-password',
      'reader'
    ]) {
      expect(logged).not.toContain(value);
    }
  });

  it('masks sensitive query values in the logged path', () => {
    const { finish } = run({
      originalUrl:
        '/api/callback?code=oauth-code&token=abc123&apiKey=xyz789&redirect=%2Fbooks&client_secret=super-secret'
    });

    finish();

    const expectedPath =
      '/api/callback?code=********&token=********&apiKey=********&redirect=%2Fbooks&client_secret=********';
    expect(infoSpy).toHaveBeenCalledWith(
      `GET ${expectedPath} 200`,
      expect.objectContaining({
        details: expect.objectContaining({ path: expectedPath })
      })
    );
  });

  it('logs nothing for /api/client-logs requests', () => {
    for (const originalUrl of [
      '/api/client-logs',
      '/api/client-logs?x=1',
      '/api/client-logs/',
      '/API/Client-Logs?x=1',
      '/api/client-logs/extra'
    ]) {
      const { next, finish } = run({ method: 'POST', originalUrl }, 204);
      finish();
      expect(next).toHaveBeenCalledOnce();
    }

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('still logs paths that merely share the client-logs prefix', () => {
    const { finish } = run({ method: 'GET', originalUrl: '/api/client-logs-other' });
    finish();

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws into the request when logging fails', () => {
    infoSpy.mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const { next, finish } = run();

    expect(() => finish()).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
  });
});
