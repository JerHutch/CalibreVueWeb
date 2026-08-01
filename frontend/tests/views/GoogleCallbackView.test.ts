import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import GoogleCallbackView from '@/views/GoogleCallbackView.vue';

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
});
