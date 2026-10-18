import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import logger from '../../src/utils/logger';
import { AuthService, User } from '../../src/services/authService';
import { CalibreService } from '../../src/services/calibreService';

const user: User = {
  id: 7,
  username: 'reader',
  email: 'reader@example.com',
  isAdmin: false,
  status: 'approved'
};

const SESSION = 'abcd1234efgh';

const buildApp = (testAuthUser?: User) =>
  createApp(
    {
      calibreService: {
        getBooks: vi.fn().mockResolvedValue({ books: [], total: 0 }),
        close: vi.fn()
      } as unknown as CalibreService,
      authService: {
        getUserById: vi.fn(),
        findOrCreateUser: vi.fn()
      } as unknown as AuthService
    },
    { enableGoogleAuth: false, ...(testAuthUser ? { testAuthUser } : {}) }
  );

// Startup logs its own lines, so drop recorded calls made while building the app.
const createTestApp = (testAuthUser?: User) => {
  const app = buildApp(testAuthUser);
  vi.clearAllMocks();
  return app;
};

const entry = (overrides: Record<string, unknown> = {}) => ({
  ts: new Date().toISOString(),
  level: 'error',
  event: 'ui.error',
  message: 'boom',
  ...overrides
});

describe('POST /api/client-logs', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(logger, 'write').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts an unauthenticated batch with 204 and writes browser entries', async () => {
    const res = await request(createTestApp())
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ details: { status: 500, ok: false, path: '/x' } })] });

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const written = writeSpy.mock.calls[0][0] as any;
    expect(written).toMatchObject({
      source: 'browser',
      sessionId: SESSION,
      level: 'error',
      event: 'ui.error',
      message: 'boom',
      details: { status: 500, ok: false, path: '/x' }
    });
    expect(written.userId).toBeUndefined();
  });

  it('adds the authenticated user id from the request context', async () => {
    const lines: string[] = [];
    writeSpy.mockRestore();
    vi.spyOn(logger as any, 'emit').mockImplementation((line: any) => {
      lines.push(line);
    });

    const res = await request(createTestApp(user))
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ userId: 'attacker', source: 'backend' })] });

    expect(res.status).toBe(204);
    const parsed = JSON.parse(lines.find(line => line.includes('"source":"browser"'))!);
    expect(parsed.userId).toBe('7');
    expect(parsed.source).toBe('browser');
    expect(parsed.sessionId).toBe(SESSION);
  });

  it('ignores client supplied userId and source', async () => {
    await request(createTestApp())
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ userId: 'attacker', source: 'backend' })] });

    const written = writeSpy.mock.calls[0][0] as any;
    expect(written.source).toBe('browser');
    expect(written.userId).toBeUndefined();
  });

  it('falls back to the X-Session-Id header', async () => {
    await request(createTestApp())
      .post('/api/client-logs')
      .set('X-Session-Id', SESSION)
      .send({ entries: [entry()] });

    expect((writeSpy.mock.calls[0][0] as any).sessionId).toBe(SESSION);
  });

  it('prefers the body session id over the header', async () => {
    await request(createTestApp())
      .post('/api/client-logs')
      .set('X-Session-Id', 'header-session-1')
      .send({ sessionId: SESSION, entries: [entry()] });

    expect((writeSpy.mock.calls[0][0] as any).sessionId).toBe(SESSION);
  });

  describe('rejections write nothing', () => {
    const cases: Array<[string, unknown]> = [
      ['entries missing', { sessionId: SESSION }],
      ['entries not an array', { sessionId: SESSION, entries: 'x' }],
      ['body is an array', [entry()]],
      ['21 entries', { sessionId: SESSION, entries: Array.from({ length: 21 }, () => entry()) }],
      ['bad level', { sessionId: SESSION, entries: [entry({ level: 'debug' })] }],
      ['event with spaces', { sessionId: SESSION, entries: [entry({ event: 'a b' })] }],
      ['event uppercase', { sessionId: SESSION, entries: [entry({ event: 'UI.Error' })] }],
      ['event too long', { sessionId: SESSION, entries: [entry({ event: 'a'.repeat(65) })] }],
      ['message not a string', { sessionId: SESSION, entries: [entry({ message: 5 })] }],
      ['invalid sessionId', { sessionId: 'short', entries: [entry()] }],
      ['valid entry followed by invalid one', { sessionId: SESSION, entries: [entry(), entry({ level: 'x' })] }]
    ];

    it.each(cases)('400 when %s', async (_name, body) => {
      const res = await request(createTestApp()).post('/api/client-logs').send(body as any);
      expect(res.status).toBe(400);
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('400 for malformed JSON without printing the body', async () => {
      const res = await request(createTestApp())
        .post('/api/client-logs')
        .set('Content-Type', 'application/json')
        .send('{"entries": [secret-body-text');

      expect(res.status).toBe(400);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('secret-body-text');
    });

    it('413 for bodies over 16 KB', async () => {
      const res = await request(createTestApp())
        .post('/api/client-logs')
        .send({ sessionId: SESSION, entries: [entry({ message: 'x'.repeat(17 * 1024) })] });

      expect(res.status).toBe(413);
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  it('truncates message to 1000 characters', async () => {
    await request(createTestApp())
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ message: 'm'.repeat(5000) })] });

    expect((writeSpy.mock.calls[0][0] as any).message).toHaveLength(1000);
  });

  it('sanitizes details', async () => {
    const details: Record<string, unknown> = {
      long: 'y'.repeat(500),
      num: 3,
      bool: true,
      nested: { a: 1 },
      list: [1],
      nothing: null,
      inf: Infinity
    };
    for (let i = 0; i < 30; i += 1) details[`k${i}`] = i;

    await request(createTestApp())
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ details })] });

    const written = (writeSpy.mock.calls[0][0] as any).details;
    expect(written.long).toHaveLength(200);
    expect(written.num).toBe(3);
    expect(written.bool).toBe(true);
    expect(written).not.toHaveProperty('nested');
    expect(written).not.toHaveProperty('list');
    expect(written).not.toHaveProperty('nothing');
    expect(Object.keys(written).length).toBeLessThanOrEqual(20);
  });

  it('drops invalid details instead of rejecting', async () => {
    const res = await request(createTestApp())
      .post('/api/client-logs')
      .send({ sessionId: SESSION, entries: [entry({ details: 'nope' })] });

    expect(res.status).toBe(204);
    expect((writeSpy.mock.calls[0][0] as any).details).toBeUndefined();
  });

  it('replaces missing, unparseable or implausible ts with server time', async () => {
    const farFuture = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const recent = new Date(Date.now() - 3600 * 1000).toISOString();
    const before = Date.now();

    await request(createTestApp())
      .post('/api/client-logs')
      .send({
        sessionId: SESSION,
        entries: [
          entry({ ts: undefined }),
          entry({ ts: 'garbage' }),
          entry({ ts: farFuture }),
          entry({ ts: recent })
        ]
      });

    const ts = writeSpy.mock.calls.map(call => (call[0] as any).ts as string);
    for (const value of ts.slice(0, 3)) {
      expect(Date.parse(value)).toBeGreaterThanOrEqual(before);
    }
    expect(ts[3]).toBe(recent);
  });

  it('writes redacted output', async () => {
    const lines: string[] = [];
    writeSpy.mockRestore();
    vi.spyOn(logger as any, 'emit').mockImplementation((line: any) => {
      lines.push(line);
    });

    await request(createTestApp())
      .post('/api/client-logs')
      .send({
        sessionId: SESSION,
        entries: [
          entry({ message: 'x?code=abc&state=s Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig a@b.com' })
        ]
      });

    expect(lines.some(line => line.includes('"source":"browser"'))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/code=abc|state=s\b|eyJhbGci|a@b\.com/);
  });

  it('rate limits to 60 requests per minute before parsing the body', async () => {
    const app = createTestApp();
    for (let i = 0; i < 60; i += 1) {
      const res = await request(app).post('/api/client-logs').send({ sessionId: SESSION, entries: [] });
      expect(res.status).toBe(204);
    }

    const limited = await request(app)
      .post('/api/client-logs')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Too many requests' });
  });

  it('does not write an http.request line for the endpoint', async () => {
    const infoSpy = vi.spyOn(logger, 'info');
    await request(createTestApp()).post('/api/client-logs').send({ sessionId: SESSION, entries: [] });
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('keeps the global json parser working for other routes', async () => {
    const res = await request(createTestApp(user))
      .post('/api/auth/logout')
      .send({ a: 1 });
    expect(res.status).not.toBe(413);
  });
});

describe('http.request session context', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('carries the X-Session-Id on the http.request line of a protected route', async () => {
    const writeSpy = vi.spyOn(logger, 'write').mockImplementation(() => {});

    await request(createTestApp(user)).get('/api/books').set('X-Session-Id', SESSION);

    const line = writeSpy.mock.calls
      .map(call => call[0] as any)
      .find(entry => entry.event === 'http.request');
    expect(line).toBeDefined();
    expect(line.sessionId).toBe(SESSION);
  });
});
