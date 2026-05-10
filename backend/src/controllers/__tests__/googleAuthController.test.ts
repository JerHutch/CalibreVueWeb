import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Response } from 'express';

const authenticateMock = vi.fn();

vi.mock('passport', () => ({
  default: {
    authenticate: authenticateMock
  }
}));

describe('Google Auth Controller', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'http://localhost:5173';
  });

  it('enables OAuth state when starting Google authentication', async () => {
    const middleware = vi.fn();
    authenticateMock.mockReturnValueOnce(middleware);

    const { authenticateGoogle } = await import('../googleAuthController.js');
    const result = authenticateGoogle();

    expect(authenticateMock).toHaveBeenCalledWith('google', {
      scope: ['profile', 'email'],
      state: true
    });
    expect(result).toBe(middleware);
  });

  it('redirects pending users to the deterministic pending callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, false, { status: 'pending' });
    });

    const { handleGoogleCallback } = await import('../googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=pending'
    );
  });

  it('redirects denied users to the deterministic denied callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, false, { status: 'denied' });
    });

    const { handleGoogleCallback } = await import('../googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=denied'
    );
  });

  it('redirects passport callback errors to the deterministic error callback', async () => {
    const req = { logIn: vi.fn() };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(new Error('oauth failure'), false, undefined);
    });

    const { handleGoogleCallback } = await import('../googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:5173/auth/google/callback?status=error'
    );
  });

  it('redirects login failures to the deterministic error callback', async () => {
    const user = { id: 1, email: 'approved@example.com', status: 'approved' };
    const req = {
      logIn: vi.fn((_user, callback: (error?: Error) => void) => callback(new Error('session failure')))
    };
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn();

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, user, undefined);
    });

    const { handleGoogleCallback } = await import('../googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).toHaveBeenCalledWith(user, expect.any(Function));
    expect(next).not.toHaveBeenCalled();
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

    authenticateMock.mockImplementationOnce((_strategy, _options, callback) => {
      return () => callback(null, user, undefined);
    });

    const { handleGoogleCallback, redirectAfterAuth } = await import('../googleAuthController.js');
    const middleware = handleGoogleCallback();
    middleware(req as any, res, next);

    expect(req.logIn).toHaveBeenCalledWith(user, expect.any(Function));
    expect(next).toHaveBeenCalledTimes(1);

    redirectAfterAuth(req as any, res);

    expect(res.redirect).toHaveBeenLastCalledWith(
      'http://localhost:5173/auth/google/callback?status=approved'
    );
  });
});
