import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OAuthLoginView from '@/views/OAuthLoginView.vue';

const order: string[] = [];
const clientLogMock = vi.fn((...args: unknown[]) => {
  order.push(`log:${String(args[1])}`);
});
const flushMock = vi.fn();
const setCookieMock = vi.fn(() => {
  order.push('cookie');
});

vi.mock('@/logging/clientLogger', () => ({
  clientLog: (...args: unknown[]) => clientLogMock(...args),
  flushClientLogs: (...args: unknown[]) => flushMock(...args),
}));

vi.mock('@/logging/sessionId', () => ({
  setSignInCookie: () => setCookieMock(),
}));

let hrefSet: string[];
const originalLocation = window.location;

describe('OAuthLoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    hrefSet = [];
    flushMock.mockImplementation(async () => {
      order.push('flush');
    });
    const fake = {
      set href(value: string) {
        order.push('redirect');
        hrefSet.push(value);
      },
      get href() {
        return 'http://localhost/login';
      },
    };
    Object.defineProperty(window, 'location', { configurable: true, value: fake });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('logs auth.login.view on mount', () => {
    mount(OAuthLoginView);
    expect(clientLogMock).toHaveBeenCalledWith('info', 'auth.login.view', 'Login page shown');
  });

  it('logs, sets cookie, flushes, then redirects in order', async () => {
    const wrapper = mount(OAuthLoginView);
    order.length = 0;
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(clientLogMock).toHaveBeenCalledWith('info', 'auth.google.click', 'Google sign-in clicked');
    expect(flushMock).toHaveBeenCalledWith({ keepalive: true, timeoutMs: 1000 });
    expect(order).toEqual(['log:auth.google.click', 'cookie', 'flush', 'redirect']);
    expect(hrefSet).toEqual(['/api/auth/google']);
  });

  it('redirects when flush rejects', async () => {
    flushMock.mockRejectedValue(new Error('nope'));
    const wrapper = mount(OAuthLoginView);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(hrefSet).toEqual(['/api/auth/google']);
  });

  it('redirects when flush throws synchronously', async () => {
    flushMock.mockImplementation(() => {
      throw new Error('sync');
    });
    const wrapper = mount(OAuthLoginView);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(hrefSet).toEqual(['/api/auth/google']);
  });

  it('redirects when setSignInCookie throws', async () => {
    setCookieMock.mockImplementationOnce(() => {
      throw new Error('cookie');
    });
    const wrapper = mount(OAuthLoginView);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(hrefSet).toEqual(['/api/auth/google']);
  });

  it('redirects within about a second when flush never settles', async () => {
    vi.useFakeTimers();
    flushMock.mockImplementation(() => new Promise(() => {}));
    const wrapper = mount(OAuthLoginView);
    await wrapper.get('button').trigger('click');
    expect(hrefSet).toEqual([]);
    await vi.advanceTimersByTimeAsync(1100);
    expect(hrefSet).toEqual(['/api/auth/google']);
  });

  it('redirects once on a double click', async () => {
    const wrapper = mount(OAuthLoginView);
    const button = wrapper.get('button');
    await button.trigger('click');
    await button.trigger('click');
    await flushPromises();
    expect(hrefSet).toEqual(['/api/auth/google']);
    expect(flushMock).toHaveBeenCalledTimes(1);
  });
});
