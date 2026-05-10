import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../authStore';

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

import api from '../../api/axios';

const mockedApi = api as unknown as {
  get: Mock;
  post: Mock;
};

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('rehydrates an approved server session from /auth/me', async () => {
    const user = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      isAdmin: false,
      status: 'approved'
    };
    mockedApi.get.mockResolvedValueOnce({
      data: {
        authenticated: true,
        user,
        status: 'approved'
      }
    });

    const store = useAuthStore();
    await store.ensureAuthInitialized();

    expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
    expect(store.user).toEqual(user);
    expect(store.isAuthenticated).toBe(true);
    expect(store.isAuthInitialized).toBe(true);
  });

  it('only checks server session once during initialization', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { authenticated: false } });

    const store = useAuthStore();
    await store.ensureAuthInitialized();
    await store.ensureAuthInitialized();

    expect(mockedApi.get).toHaveBeenCalledTimes(1);
    expect(store.user).toBeNull();
    expect(store.isAuthInitialized).toBe(true);
  });
});
