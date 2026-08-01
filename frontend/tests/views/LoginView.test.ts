import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginView from '@/views/LoginView.vue';
import { useAuthStore } from '@/stores/authStore';

const pushMock = vi.fn();

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
    }),
  };
});

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits credentials and navigates to books on success', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        auth: {
          error: null,
        },
      },
    });
    const store = useAuthStore(pinia);
    store.login.mockResolvedValue({ ok: true });

    const wrapper = mount(LoginView, {
      global: { plugins: [pinia] },
    });

    await wrapper.get('#username').setValue('reader');
    await wrapper.get('#password').setValue('secret');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(store.login).toHaveBeenCalledWith('reader', 'secret');
    expect(pushMock).toHaveBeenCalledWith('/books');
  });

  it('renders store errors and keeps the user on the page when login fails', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        auth: {
          error: 'Invalid credentials',
        },
      },
    });
    const store = useAuthStore(pinia);
    store.login.mockRejectedValue(new Error('Invalid credentials'));

    const wrapper = mount(LoginView, {
      global: { plugins: [pinia] },
    });

    await wrapper.get('#username').setValue('reader');
    await wrapper.get('#password').setValue('wrong');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.text()).toContain('Invalid credentials');
    expect(pushMock).not.toHaveBeenCalled();
    expect(store.login).toHaveBeenCalledWith('reader', 'wrong');
    expect(wrapper.get('button').text()).toBe('Login');
  });
});
