import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientLog,
  describeError,
  flushClientLogs,
  installGlobalErrorHandlers,
  resetClientLogger
} from '@/logging/clientLogger';
import { getSessionId } from '@/logging/sessionId';

type FetchInit = {
  method: string;
  headers: Record<string, string>;
  body: string;
  credentials: string;
  keepalive?: boolean;
};

const ok = () => Promise.resolve({ ok: true, status: 204 });
const status = (code: number) => () => Promise.resolve({ ok: code < 400, status: code });

let fetchMock: ReturnType<typeof vi.fn>;

const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse((init as FetchInit).body));
const sentEntries = () => bodies().flatMap((b) => b.entries);
const byteLength = (s: string) => new TextEncoder().encode(s).length;

function fakeApp(existing?: (...args: unknown[]) => void) {
  return { config: { errorHandler: existing } } as any;
}

describe('clientLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    fetchMock = vi.fn(ok);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    resetClientLogger();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('batching', () => {
    it('queues entries and flushes them after 5 seconds', async () => {
      clientLog('info', 'test.event', 'hello', { a: 1 });
      await vi.advanceTimersByTimeAsync(4999);
      expect(fetchMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, FetchInit];
      expect(url).toBe('/api/client-logs');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      });
      expect(init.credentials).toBe('same-origin');
      expect(init.keepalive).toBeFalsy();

      const body = JSON.parse(init.body);
      expect(body.sessionId).toBe(getSessionId());
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0]).toMatchObject({
        level: 'info',
        event: 'test.event',
        message: 'hello',
        details: { a: 1 }
      });
      expect(new Date(body.entries[0].ts).toISOString()).toBe(body.entries[0].ts);
    });

    it('keeps no timer while the queue is empty', async () => {
      const base = vi.getTimerCount();
      clientLog('info', 'a.b', 'x');
      expect(vi.getTimerCount()).toBe(base + 1);
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(base);
    });

    it('flushes immediately when 20 entries are queued', async () => {
      for (let i = 0; i < 19; i += 1) clientLog('info', 'a.b', `m${i}`);
      expect(fetchMock).not.toHaveBeenCalled();
      clientLog('info', 'a.b', 'm19');
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(bodies()[0].entries).toHaveLength(20);
    });

    it('splits larger backlogs into requests of at most 20 entries', async () => {
      for (let i = 0; i < 45; i += 1) clientLog('info', 'a.b', `m${i}`);
      await vi.advanceTimersByTimeAsync(10000);
      expect(sentEntries()).toHaveLength(45);
      for (const b of bodies()) {
        expect(b.entries.length).toBeLessThanOrEqual(20);
      }
    });

    it('splits batches so every body stays under the size cap', async () => {
      const details = Object.fromEntries(
        ['a', 'b', 'c', 'd', 'e'].map((k) => [k, '€'.repeat(200)])
      );
      for (let i = 0; i < 12; i += 1) {
        clientLog('error', 'a.b', '€'.repeat(1000), details);
      }
      await flushClientLogs();
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
      expect(sentEntries()).toHaveLength(12);
      for (const [, init] of fetchMock.mock.calls) {
        expect(byteLength((init as FetchInit).body)).toBeLessThanOrEqual(15000);
      }
    });

    it('flushes with keepalive on pagehide', async () => {
      installGlobalErrorHandlers(fakeApp());
      clientLog('info', 'a.b', 'bye');
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((fetchMock.mock.calls[0][1] as FetchInit).keepalive).toBe(true);
    });

    it('flushes with keepalive when the page becomes hidden only', async () => {
      installGlobalErrorHandlers(fakeApp());
      let state = 'visible';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
        () => state as DocumentVisibilityState
      );
      clientLog('info', 'a.b', 'one');
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).not.toHaveBeenCalled();

      state = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((fetchMock.mock.calls[0][1] as FetchInit).keepalive).toBe(true);
    });

    it('does not send duplicates when flush is called twice', async () => {
      let release: (v: unknown) => void = () => {};
      fetchMock.mockImplementation(
        () => new Promise((resolve) => { release = resolve; })
      );
      clientLog('info', 'a.b', 'one');
      clientLog('info', 'a.b', 'two');
      const first = flushClientLogs();
      const second = flushClientLogs();
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      release({ ok: true, status: 204 });
      await Promise.all([first, second]);
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentEntries()).toHaveLength(2);
    });

    it('applies keepalive passed to flushClientLogs', async () => {
      clientLog('info', 'a.b', 'x');
      await flushClientLogs({ keepalive: true });
      expect((fetchMock.mock.calls[0][1] as FetchInit).keepalive).toBe(true);
    });
  });

  describe('failures', () => {
    it('retries a rejecting fetch at most twice and then drops the batch', async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
      clientLog('info', 'a.b', 'x');
      await vi.advanceTimersByTimeAsync(5000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(500);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('retries a 500 response at most twice', async () => {
      fetchMock.mockImplementation(status(500));
      clientLog('info', 'a.b', 'x');
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each([400, 413, 429, 204])('does not retry status %i', async (code) => {
      fetchMock.mockImplementation(status(code));
      clientLog('info', 'a.b', 'x');
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('survives fetch throwing synchronously', async () => {
      fetchMock.mockImplementation(() => {
        throw new Error('sync');
      });
      clientLog('info', 'a.b', 'x');
      const flushed = flushClientLogs();
      await vi.advanceTimersByTimeAsync(60000);
      await expect(flushed).resolves.toBeUndefined();
    });

    it('keeps the buffer at 100 entries (oldest dropped) with a dead backend', async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
      for (let i = 0; i < 150; i += 1) clientLog('info', 'a.b', `m${i}`);
      await vi.advanceTimersByTimeAsync(120000);
      const sent = new Set(sentEntries().map((e) => e.message));
      // m0-m19 were taken by the first immediate flush; m20-m49 overflowed.
      expect(sent.size).toBe(120);
      expect(sent.has('m0')).toBe(true);
      expect(sent.has('m19')).toBe(true);
      expect(sent.has('m20')).toBe(false);
      expect(sent.has('m49')).toBe(false);
      expect(sent.has('m50')).toBe(true);
      expect(sent.has('m149')).toBe(true);
    });

    it('resolves flushClientLogs after timeoutMs when fetch never settles', async () => {
      fetchMock.mockImplementation(() => new Promise(() => {}));
      clientLog('info', 'a.b', 'x');
      let done = false;
      void flushClientLogs({ timeoutMs: 1000 }).then(() => {
        done = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
    });

    it('does not throw when fetch is undefined', async () => {
      vi.stubGlobal('fetch', undefined);
      expect(() => clientLog('error', 'a.b', 'x')).not.toThrow();
      await expect(flushClientLogs()).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(60000);
    });

    it('does not throw when details are hostile', () => {
      const hostile = {} as any;
      Object.defineProperty(hostile, 'bad', {
        enumerable: true,
        get() {
          throw new Error('getter');
        }
      });
      expect(() => clientLog('info', 'a.b', 'x', hostile)).not.toThrow();
    });
  });

  describe('sanitizing', () => {
    it('normalizes level, event, message and details', async () => {
      clientLog('debug' as any, 'My Event/Foo!', 'm'.repeat(2000), {
        'bad key!': 'v',
        long: 'x'.repeat(300),
        n: 3,
        nan: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
        flag: false,
        obj: { a: 1 } as any,
        undef: undefined as any
      });
      clientLog('info', '', 'empty event');
      clientLog('info', 'e'.repeat(100), 'long event');
      await flushClientLogs();
      const [a, b, c] = sentEntries();
      expect(a.level).toBe('info');
      expect(a.event).toBe('my.event.foo.');
      expect(a.message).toHaveLength(1000);
      expect(a.details).toEqual({
        'bad_key_': 'v',
        long: 'x'.repeat(200),
        n: 3,
        flag: false
      });
      expect(b.event).toBe('client.log');
      expect(c.event).toBe('e'.repeat(64));
      for (const entry of [a, b, c]) {
        expect(entry.event).toMatch(/^[a-z0-9._-]+$/);
      }
    });
  });

  describe('describeError', () => {
    it('describes an axios-shaped error with an allowlist only', () => {
      const result = describeError({
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        message: 'Request failed with token=abc',
        config: {
          method: 'get',
          url: '/books/5/cover?token=x',
          params: { token: 'x' },
          data: 'body',
          headers: { Authorization: 'Bearer z' }
        },
        response: { status: 404, data: 'secret', headers: { a: 'b' } }
      });
      expect(result).toEqual({
        name: 'AxiosError',
        code: 'ERR_BAD_REQUEST',
        status: 404,
        method: 'GET',
        path: '/books/5/cover'
      });
    });

    it('strips origin and fragment from the path and omits missing fields', () => {
      expect(
        describeError({
          isAxiosError: true,
          name: 'AxiosError',
          config: { method: 'post', url: 'https://example.com/api/x/y?a=b#frag' }
        })
      ).toEqual({ name: 'AxiosError', method: 'POST', path: '/api/x/y' });
    });

    it('describes a plain Error', () => {
      expect(describeError(new Error('boom'))).toEqual({ name: 'Error', message: 'boom' });
      expect(describeError(new TypeError('x'.repeat(500))).message).toHaveLength(200);
    });

    it('describes other values', () => {
      expect(describeError('oops')).toEqual({ value: 'oops' });
      expect((describeError('y'.repeat(500)) as { value: string }).value).toHaveLength(200);
      expect(describeError(null)).toEqual({ value: 'null' });
      const evil = {
        toString() {
          throw new Error('nope');
        }
      };
      expect(() => describeError(evil)).not.toThrow();
    });
  });

  describe('installGlobalErrorHandlers', () => {
    it('logs window error events', async () => {
      installGlobalErrorHandlers(fakeApp());
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'm'.repeat(300),
          filename: 'http://localhost/assets/app.js?token=secret',
          lineno: 3,
          colno: 4
        })
      );
      await flushClientLogs();
      const [entry] = sentEntries();
      expect(entry.level).toBe('error');
      expect(entry.event).toBe('window.error');
      expect(entry.details).toEqual({
        message: 'm'.repeat(200),
        filename: '/assets/app.js',
        lineno: 3,
        colno: 4
      });
    });

    it('logs unhandled rejections', async () => {
      installGlobalErrorHandlers(fakeApp());
      const event = new Event('unhandledrejection');
      Object.assign(event, { reason: new Error('late') });
      window.dispatchEvent(event);
      await flushClientLogs();
      const [entry] = sentEntries();
      expect(entry.level).toBe('error');
      expect(entry.event).toBe('window.unhandledrejection');
      expect(entry.details).toEqual({ name: 'Error', message: 'late' });
    });

    it('logs Vue errors and then calls an existing handler', async () => {
      const previous = vi.fn();
      const app = fakeApp(previous);
      installGlobalErrorHandlers(app);
      const err = new Error('render failed');
      app.config.errorHandler(err, null, 'i'.repeat(300));
      expect(previous).toHaveBeenCalledTimes(1);
      expect(previous).toHaveBeenCalledWith(err, null, 'i'.repeat(300));
      await flushClientLogs();
      const [entry] = sentEntries();
      expect(entry.level).toBe('error');
      expect(entry.event).toBe('vue.error');
      expect(entry.details).toEqual({
        name: 'Error',
        message: 'render failed',
        info: 'i'.repeat(100)
      });
    });

    it('is idempotent', async () => {
      const spy = vi.spyOn(window, 'addEventListener');
      const previous = vi.fn();
      const app = fakeApp(previous);
      installGlobalErrorHandlers(app);
      const afterFirst = spy.mock.calls.length;
      installGlobalErrorHandlers(app);
      expect(spy.mock.calls.length).toBe(afterFirst);

      window.dispatchEvent(new ErrorEvent('error', { message: 'once' }));
      app.config.errorHandler(new Error('v'), null, 'info');
      await flushClientLogs();
      const events = sentEntries().map((e) => e.event);
      expect(events.filter((e) => e === 'window.error')).toHaveLength(1);
      expect(events.filter((e) => e === 'vue.error')).toHaveLength(1);
      expect(previous).toHaveBeenCalledTimes(1);
    });
  });
});
