import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import GoogleCallbackView from '@/views/GoogleCallbackView.vue';

const clientLogMock = vi.fn();
vi.mock('@/logging/clientLogger', () => ({
  clientLog: (...args: unknown[]) => clientLogMock(...args),
}));

const pushMock = vi.fn();
const replaceMock = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);
const checkAuthMock = vi.fn().mockResolvedValue(undefined);
const resetMock = vi.fn();

const routeState = reactive({
  query: {} as Record<string, string>,
});

const authState = reactive({
  isAuthenticated: false,
});

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      push: pushMock,
      replace: replaceMock,
    }),
  };
});

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    checkAuth: checkAuthMock,
    logout: logoutMock,
    reset: resetMock,
    get isAuthenticated() {
      return authState.isAuthenticated;
    },
  }),
}));

describe('GoogleCallbackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.query = {};
    authState.isAuthenticated = false;
  });

  it('resets auth and renders pending status without checking auth again', async () => {
    routeState.query = { status: 'pending' };

    const wrapper = mount(GoogleCallbackView);
    await flushPromises();

    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(checkAuthMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Account Pending Approval');
  });

  it('routes approved users to the books page after auth check', async () => {
    routeState.query = { status: 'approved' };
    authState.isAuthenticated = true;

    mount(GoogleCallbackView);
    await flushPromises();

    expect(checkAuthMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith({ name: 'books' });
  });

  it('shows an authentication failure when approval does not yield a session', async () => {
    routeState.query = { status: 'approved' };

    const wrapper = mount(GoogleCallbackView);
    await flushPromises();

    expect(wrapper.text()).toContain('Authentication failed');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('logs out and returns to login from a denied state', async () => {
    routeState.query = { status: 'denied' };

    const wrapper = mount(GoogleCallbackView);
    await flushPromises();

    await wrapper.get('button').trigger('click');

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith({ name: 'login' });
  });

  it.each([
    ['pending', 'warn'],
    ['denied', 'warn'],
    ['error', 'error'],
    ['approved', 'info'],
  ])('logs auth.callback.view for status %s at level %s', async (status, level) => {
    routeState.query = { status };
    authState.isAuthenticated = true;

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith(
      level,
      'auth.callback.view',
      `Sign-in callback shown (${status})`,
      { status }
    );
  });

  it('logs status none when the query has no valid status', async () => {
    routeState.query = { status: 'bogus', code: 'secret' };

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith(
      'info',
      'auth.callback.view',
      'Sign-in callback shown (none)',
      { status: 'none' }
    );
  });

  it('logs auth.callback.result as info when authenticated', async () => {
    routeState.query = { status: 'approved' };
    authState.isAuthenticated = true;

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith(
      'info',
      'auth.callback.result',
      'Sign-in check finished (authenticated=true)',
      { authenticated: true }
    );
  });

  it('logs auth.callback.result as warn when not authenticated', async () => {
    routeState.query = { status: 'approved' };

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith(
      'warn',
      'auth.callback.result',
      'Sign-in check finished (authenticated=false)',
      { authenticated: false }
    );
  });

  it('logs auth.callback.result as error when checkAuth throws', async () => {
    routeState.query = { status: 'approved' };
    checkAuthMock.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith(
      'error',
      'auth.callback.result',
      'Sign-in check finished (authenticated=false)',
      { authenticated: false, failed: true }
    );
    consoleError.mockRestore();
  });

  it('does not log a result for pending status', async () => {
    routeState.query = { status: 'pending' };

    mount(GoogleCallbackView);
    await flushPromises();

    expect(clientLogMock).not.toHaveBeenCalledWith(
      expect.anything(),
      'auth.callback.result',
      expect.anything(),
      expect.anything()
    );
  });
});
