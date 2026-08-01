import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import App from '@/App.vue';

const pushMock = vi.fn();
const logoutMock = vi.fn();

const authState = reactive({
  isAuthenticated: false,
  isAdmin: false,
  user: null as null | { username?: string; displayName?: string },
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return authState.isAuthenticated;
    },
    get isAdmin() {
      return authState.isAdmin;
    },
    get user() {
      return authState.user;
    },
    logout: logoutMock,
  }),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.user = null;
  });

  it('shows navigation links based on auth state', () => {
    authState.isAuthenticated = true;
    authState.isAdmin = true;
    authState.user = { displayName: 'Admin User', username: 'admin' };

    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
          },
          RouterView: { template: '<div />' },
        },
      },
    });

    expect(wrapper.text()).toContain('Books');
    expect(wrapper.text()).toContain('Admin');
    expect(wrapper.text()).toContain('Admin User');
  });

  it('logs out and routes to login', async () => {
    authState.isAuthenticated = true;
    authState.user = { username: 'reader' };

    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: true,
          RouterView: true,
        },
      },
    });

    await wrapper.get('button').trigger('click');

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/login');
  });
});
