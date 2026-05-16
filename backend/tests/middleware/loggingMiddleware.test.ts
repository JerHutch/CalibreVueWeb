import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestLogger } from '../../src/middleware/loggingMiddleware';
import logger from '../../src/utils/logger';

describe('requestLogger', () => {
  const next = vi.fn();
  const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts sensitive query parameter values in request and response log lines', () => {
    const finishHandlers: Array<() => void> = [];
    const req = {
      method: 'GET',
      originalUrl:
        '/api/callback?code=oauth-code&token=abc123&apiKey=xyz789&redirect=%2Fbooks&client_secret=super-secret',
      headers: {},
      body: {}
    };
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandlers.push(handler);
        }
      })
    };

    requestLogger(req as any, res as any, next);
    finishHandlers.forEach(handler => handler());

    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /\] GET \/api\/callback\?code=\*{8}&token=\*{8}&apiKey=\*{8}&redirect=%2Fbooks&client_secret=\*{8}$/
      )
    );
    expect(infoSpy).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /\] GET \/api\/callback\?code=\*{8}&token=\*{8}&apiKey=\*{8}&redirect=%2Fbooks&client_secret=\*{8} - 200 \(\d+ms\)$/
      )
    );
  });

  it('redacts sensitive request headers before logging', () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/books',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'session=abc123',
        'set-cookie': 'refresh=def456',
        'x-api-key': 'key-value',
        'x-secret-token': 'top-secret',
        accept: 'application/json'
      },
      body: {}
    };
    const res = {
      on: vi.fn()
    };

    requestLogger(req as any, res as any, next);

    expect(infoSpy).toHaveBeenCalledWith(
      'Headers: ' +
        JSON.stringify(
          {
            authorization: '********',
            cookie: '********',
            'set-cookie': '********',
            'x-api-key': '********',
            'x-secret-token': '********',
            accept: 'application/json'
          },
          null,
          2
        )
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('masks sensitive body fields before logging', () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/login',
      headers: {},
      body: {
        username: 'reader',
        password: 'plaintext',
        nested: {
          token: 'abc123'
        }
      }
    };
    const res = {
      on: vi.fn()
    };

    requestLogger(req as any, res as any, next);

    expect(infoSpy).toHaveBeenCalledWith(
      'Body: ' +
        JSON.stringify(
          {
            username: 'reader',
            password: '********',
            nested: {
              token: '********'
            }
          },
          null,
          2
        )
    );
  });
});
