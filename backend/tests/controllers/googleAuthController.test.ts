import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Response } from 'express';

const authenticateMock = vi.fn();
const useMock = vi.fn();
const serializeUserMock = vi.fn();
const deserializeUserMock = vi.fn();

vi.mock('passport', () => ({
  default: {
    authenticate: authenticateMock,
    use: useMock,
    serializeUser: serializeUserMock,
    deserializeUser: deserializeUserMock
  }
}));

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

async function spyOnLogger() {
  const { default: logger } = await import('../../src/utils/logger.js');
  const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const all = () => [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls];
  const events = (spy: typeof info, event: string) =>
    spy.mock.calls.filter(call => (call[1] as any)?.event === event);
  return { logger, info, warn, error, all, events };
}

describe('Google Auth Controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  it('enables OAuth state when starting Google authentication', async () => {
    const middleware = vi.fn();
    authenticateMock.mockReturnValueOnce(middleware);

    const { authenticateGoogle } = await import('../../src/controllers/googleAuthController.js');
    const result = authenticateGoogle();

    expect(authenticateMock).toHaveBeenCalledWith('google', {
      scope: ['profile', 'email'],
      state: true
    });
    const req = {};
    const res = {};
    const next = vi.fn();
    result(req as any, res as any, next);
    expect(middleware).toHaveBeenCalledWith(req, res, next);
  });

  it('logs auth.google.start per request, not when the route is built', async () => {
    authenticateMock.mockReturnValueOnce(vi.fn());
    const { info, events } = await spyOnLogger();

    const { authenticateGoogle } = await import('../../src/controllers/googleAuthController.js');
    const handler = authenticateGoogle();
    expect(events(info, 'auth.google.start')).toHaveLength(0);

    handler({} as any, {} as any, vi.fn());
    handler({} as any, {} as any, vi.fn());
    expect(events(info, 'auth.google.start')).toHaveLength(2);
  });

  it('logs auth.google.callback with a capped googleError only', async () => {
    authenticateMock.mockImplementation((_s, _o, callback) => () => callback(null, false, undefined));
    const { info, all, events } = await spyOnLogger();
    const res = { redirect: vi.fn() } as unknown as Response;

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware({ query: { error: 'access_denied', code: 'SECRETCODE', state: 'SECRETSTATE' } } as any, res, vi.fn());
    middleware({ query: { error: 'x'.repeat(300) } } as any, res, vi.fn());
    middleware({ query: { error: ['a', 'b'] } } as any, res, vi.fn());
    middleware({ query: {} } as any, res, vi.fn());
    middleware({} as any, res, vi.fn());

    const calls = events(info, 'auth.google.callback');
    expect(calls).toHaveLength(5);
    expect((calls[0][1] as any).details).toEqual({ googleError: 'access_denied' });
    expect((calls[1][1] as any).details.googleError).toHaveLength(100);
    expect((calls[2][1] as any).details?.googleError).toBeUndefined();
    expect((calls[3][1] as any).details?.googleError).toBeUndefined();
    const text = JSON.stringify(all());
    expect(text).not.toContain('SECRETCODE');
    expect(text).not.toContain('SECRETSTATE');
    authenticateMock.mockReset();
  });

  it('redirects pending users to the deterministic pending callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const { warn, events, all } = await spyOnLogger();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, false, { status: 'pending' });
    });

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=pending'
    );
    expect(events(warn, 'auth.google.outcome')).toHaveLength(1);
    expect((events(warn, 'auth.google.outcome')[0][1] as any).details).toEqual({ status: 'pending' });
    expect(JSON.stringify(all())).not.toMatch(EMAIL_PATTERN);
  });

  it('redirects denied users to the deterministic denied callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const { warn, events } = await spyOnLogger();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, false, { status: 'denied' });
    });

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=denied'
    );
    expect(events(warn, 'auth.google.outcome')).toHaveLength(1);
    expect((events(warn, 'auth.google.outcome')[0][1] as any).details).toEqual({ status: 'denied' });
  });

  it('redirects passport callback errors to the deterministic error callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const { error, events } = await spyOnLogger();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(new Error('oauth failure'), false, undefined);
    });

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=error'
    );
    expect(events(error, 'auth.google.outcome')).toHaveLength(1);
    expect((events(error, 'auth.google.outcome')[0][1] as any).details).toEqual({
      status: 'error',
      reason: 'passport_error'
    });
  });

  it('logs no_user as a warning when passport yields no user and no status', async () => {
    const res = { redirect: vi.fn() } as unknown as Response;
    const { warn, events } = await spyOnLogger();
    authenticateMock.mockImplementationOnce((_s, _o, callback) => () => callback(null, false, undefined));

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    handleGoogleCallback()({ logIn: vi.fn() } as any, res, vi.fn());

    expect((events(warn, 'auth.google.outcome')[0][1] as any).details).toEqual({ status: 'no_user' });
  });

  it('redirects login failures to the deterministic error callback', async () => {
    const user = { id: 1, email: 'approved@example.com', status: 'approved' };
    const req = {
      logIn: vi.fn((_user, callback: (error?: Error) => void) => callback(new Error('session failure')))
    };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const { error, events, all } = await spyOnLogger();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, user, undefined);
    });

    const { handleGoogleCallback } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).toHaveBeenCalledWith(user, expect.any(Function));
    expect(next).not.toHaveBeenCalled();
    expect(events(error, 'auth.google.outcome')).toHaveLength(1);
    expect((events(error, 'auth.google.outcome')[0][1] as any).details).toEqual({
      status: 'error',
      reason: 'login_failed'
    });
    expect(JSON.stringify(all())).not.toMatch(EMAIL_PATTERN);
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=error'
    );
  });

  it('creates a session for approved users and redirects to the approved callback', async () => {
    const user = { id: 1, email: 'approved@example.com', status: 'approved' };
    const req = {
      logIn: vi.fn((_user, callback: (error?: Error) => void) => callback())
    };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();
    const { info, events, all } = await spyOnLogger();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, user, undefined);
    });

    const { handleGoogleCallback, redirectAfterAuth } = await import('../../src/controllers/googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).toHaveBeenCalledWith(user, expect.any(Function));
    expect(next).toHaveBeenCalledTimes(1);
    expect(events(info, 'auth.google.outcome')).toHaveLength(1);
    expect(events(info, 'auth.google.outcome')[0][1]).toMatchObject({
      userId: '1',
      details: { status: 'approved' }
    });

    redirectAfterAuth(req as any, res);

    expect(res.redirect).toHaveBeenLastCalledWith(
      'http://localhost:5173/auth/google/callback?status=approved'
    );
  });

  describe('passport wiring', () => {
    const makeService = (user: any) => ({
      findOrCreateUser: vi.fn().mockResolvedValue(user),
      getUserById: vi.fn().mockResolvedValue(user)
    });

    async function getVerify(service: any) {
      const { initializeGoogleStrategy } = await import('../../src/controllers/googleAuthController.js');
      initializeGoogleStrategy(service);
      return (useMock.mock.calls[0][0] as any)._verify as (...args: any[]) => Promise<void>;
    }

    const profile = {
      id: 'google-id-999',
      displayName: 'Secret Person',
      emails: [{ value: 'profile@example.com' }]
    };

    it('logs user ids and never Google profile data in the verify callback', async () => {
      const spies = await spyOnLogger();
      for (const status of ['approved', 'pending', 'denied']) {
        useMock.mockClear();
        const user = { id: 7, email: 'person@example.com', status };
        const verify = await getVerify(makeService(user));
        const done = vi.fn();
        await verify('at', 'rt', profile, done);
        expect(done).toHaveBeenCalledTimes(1);
      }
      useMock.mockClear();
      await (await getVerify(makeService(undefined)))('at', 'rt', profile, vi.fn());

      const text = JSON.stringify(spies.all());
      expect(text).not.toMatch(EMAIL_PATTERN);
      expect(text).not.toContain('Secret Person');
      expect(text).not.toContain('google-id-999');
      expect(text).toContain('7');
    });

    it('does not log per-request serialize or deserialize lines', async () => {
      const spies = await spyOnLogger();
      const user = { id: 7, email: 'person@example.com', status: 'approved' };
      const { initializePassportSession } = await import('../../src/controllers/googleAuthController.js');
      initializePassportSession(makeService(user) as any);
      const serialize = serializeUserMock.mock.calls[0][0];
      const deserialize = deserializeUserMock.mock.calls[0][0];
      spies.info.mockClear();

      serialize(user, vi.fn());
      await deserialize(7, vi.fn());

      expect(spies.info).not.toHaveBeenCalled();
      expect(JSON.stringify(spies.all())).not.toMatch(EMAIL_PATTERN);
    });

    it('logs deserialize failures without an email', async () => {
      const spies = await spyOnLogger();
      const service = { getUserById: vi.fn().mockRejectedValue(new Error('db down')) };
      const { initializePassportSession } = await import('../../src/controllers/googleAuthController.js');
      initializePassportSession(service as any);
      const done = vi.fn();
      await deserializeUserMock.mock.calls[0][0](7, done);

      expect(spies.error).toHaveBeenCalledTimes(1);
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });

    it('propagates the request context into the async verify callback', async () => {
      // Real logger methods (no level spies) so the real context merge runs; capture at write().
      const { default: logger } = await import('../../src/utils/logger.js');
      const write = vi.spyOn(logger, 'write').mockImplementation(() => {});
      const { runWithContext } = await import('../../src/utils/requestContext.js');
      const user = { id: 7, email: 'person@example.com', status: 'approved' };
      const verify = await getVerify(makeService(user));
      write.mockClear();

      await runWithContext({ sessionId: 'abcd1234' }, () => verify('at', 'rt', profile, vi.fn()));

      const entries = write.mock.calls.map(call => call[0] as any);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every(entry => entry.sessionId === 'abcd1234')).toBe(true);
      expect(entries.some(entry => entry.userId === '7')).toBe(true);
      expect(JSON.stringify(entries)).not.toMatch(EMAIL_PATTERN);
    });
  });
});
