import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const clientLog = vi.hoisted(() => vi.fn());

vi.mock('@/logging/clientLogger', async () => {
  const actual = await vi.importActual<typeof import('@/logging/clientLogger')>(
    '@/logging/clientLogger'
  );
  return { ...actual, clientLog };
});

vi.mock('@/logging/sessionId', () => ({
  SESSION_HEADER: 'X-Session-Id',
  getSessionId: () => 'session-abc'
}));

import api from '@/api/axios';

type Adapter = NonNullable<typeof api.defaults.adapter>;

function failWithStatus(status: number): Adapter {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('failed', 'ERR_BAD_REQUEST', config, {}, {
        status,
        statusText: '',
        headers: {},
        config,
        data: {}
      })
    );
}

describe('api axios instance', () => {
  beforeEach(() => {
    clientLog.mockReset();
  });

  it('adds the session header to every request', async () => {
    let seen: unknown;
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      seen = config.headers.get('X-Session-Id');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    }) as Adapter;
    await api.get('/books');
    expect(seen).toBe('session-abc');
  });

  it('logs nothing for successful responses', async () => {
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    })) as Adapter;
    await api.get('/books');
    expect(clientLog).not.toHaveBeenCalled();
  });

  it('logs a 404 as error with path and no query string', async () => {
    api.defaults.adapter = failWithStatus(404);
    await expect(api.get('/books/5/cover?token=secret')).rejects.toBeTruthy();
    expect(clientLog).toHaveBeenCalledTimes(1);
    expect(clientLog).toHaveBeenCalledWith(
      'error',
      'http.failed',
      'GET /books/5/cover failed (404)',
      expect.objectContaining({ status: 404, method: 'GET', path: '/books/5/cover' })
    );
  });

  it('logs a 500 as error', async () => {
    api.defaults.adapter = failWithStatus(500);
    await expect(api.post('/books')).rejects.toBeTruthy();
    expect(clientLog).toHaveBeenCalledWith(
      'error',
      'http.failed',
      'POST /books failed (500)',
      expect.objectContaining({ status: 500 })
    );
  });

  it('logs a network error as error', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config))) as Adapter;
    await expect(api.get('/books')).rejects.toBeTruthy();
    expect(clientLog).toHaveBeenCalledWith(
      'error',
      'http.failed',
      'GET /books failed (network error)',
      expect.objectContaining({ errorCode: 'ERR_NETWORK' })
    );
  });

  it.each([401, 403])('logs %i as warn', async (status) => {
    api.defaults.adapter = failWithStatus(status);
    await expect(api.get('/auth/me')).rejects.toBeTruthy();
    expect(clientLog).toHaveBeenCalledWith(
      'warn',
      'http.failed',
      `GET /auth/me failed (${status})`,
      expect.objectContaining({ status })
    );
  });

  it('does not log cancelled requests', async () => {
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
      Promise.reject(new axios.CanceledError('canceled', config))) as Adapter;
    await expect(api.get('/books')).rejects.toBeTruthy();
    expect(clientLog).not.toHaveBeenCalled();
  });

  it('rejects the original error object', async () => {
    let original: unknown;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      original = new AxiosError('boom', 'ERR_BAD_RESPONSE', config, {}, {
        status: 500,
        statusText: '',
        headers: {},
        config,
        data: {}
      });
      return Promise.reject(original);
    }) as Adapter;
    const caught = await api.get('/books').catch((e) => e);
    expect(caught).toBe(original);
  });

  it('still rejects the original error when logging throws', async () => {
    clientLog.mockImplementation(() => {
      throw new Error('logger down');
    });
    let original: unknown;
    api.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      original = new AxiosError('boom', 'ERR_BAD_RESPONSE', config, {}, {
        status: 500,
        statusText: '',
        headers: {},
        config,
        data: {}
      });
      return Promise.reject(original);
    }) as Adapter;
    const caught = await api.get('/books').catch((e) => e);
    expect(caught).toBe(original);
  });
});
