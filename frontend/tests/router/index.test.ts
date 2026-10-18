import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type AuthState = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

const flushRouter = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('router guards', () => {
  let state: AuthState;
  let ensureAuthInitialized: ReturnType<typeof vi.fn>;
  let clientLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/');
    state = {
      isAuthenticated: false,
      isAdmin: false,
    };
    ensureAuthInitialized = vi.fn().mockResolvedValue(undefined);
    clientLog = vi.fn();

    vi.doMock('@/logging/clientLogger', async () => {
      const actual = await vi.importActual<typeof import('@/logging/clientLogger')>(
        '@/logging/clientLogger'
      );
      return { ...actual, clientLog };
    });

    vi.doMock('@/stores/authStore', () => ({
      useAuthStore: () => ({
        ensureAuthInitialized,
        get isAuthenticated() {
          return state.isAuthenticated;
        },
        get isAdmin() {
          return state.isAdmin;
        },
      }),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login for protected routes', async () => {
    const { default: router } = await import('@/router');

    await router.push('/books');
    await flushRouter();

    expect(ensureAuthInitialized).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('logs auth.redirect.login with a path that has no query string', async () => {
    const { default: router } = await import('@/router');

    await router.push('/books?x=1');
    await flushRouter();

    expect(router.currentRoute.value.name).toBe('login');
    expect(clientLog).toHaveBeenCalledWith('info', 'auth.redirect.login', 'Redirected to login', {
      from: '/books',
    });
  });

  it('does not log auth.redirect.login for authenticated users', async () => {
    state.isAuthenticated = true;
    const { default: router } = await import('@/router');

    await router.push('/books');
    await flushRouter();

    expect(clientLog).not.toHaveBeenCalledWith(
      expect.anything(),
      'auth.redirect.login',
      expect.anything(),
      expect.anything()
    );
  });

  it('redirects non-admin users away from admin routes', async () => {
    state.isAuthenticated = true;
    const { default: router } = await import('@/router');

    await router.push('/admin');
    await flushRouter();

    expect(ensureAuthInitialized).toHaveBeenCalledTimes(2);
    expect(router.currentRoute.value.name).toBe('books');
  });

  it('allows authenticated admins onto admin routes', async () => {
    state.isAuthenticated = true;
    state.isAdmin = true;
    const { default: router } = await import('@/router');

    await router.push('/admin');
    await router.isReady();

    expect(ensureAuthInitialized).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('admin');
  });

  it('logs router errors and keeps console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: router } = await import('@/router');
    const boom = new Error('chunk failed');
    ensureAuthInitialized.mockRejectedValueOnce(boom);

    await router.push('/books').catch(() => undefined);
    await flushRouter();

    expect(consoleError).toHaveBeenCalledWith('Router error:', boom);
    expect(clientLog).toHaveBeenCalledWith(
      'error',
      'router.error',
      'Router error',
      expect.objectContaining({ name: 'Error', message: 'chunk failed' })
    );
    consoleError.mockRestore();
  });
});
