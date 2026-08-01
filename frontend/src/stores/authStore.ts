import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';

export type UserStatus = 'pending' | 'approved' | 'denied';

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  googleId?: string;
  displayName?: string;
  picture?: string;
  status: UserStatus;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const error = ref<string | null>(null);
  const isAuthInitialized = ref(false);
  let authInitializationPromise: Promise<void> | null = null;

  // Computed
  const isAuthenticated = computed(() => !!user.value && user.value.status === 'approved');
  const isAdmin = computed(() => user.value?.isAdmin ?? false);
  const isPending = computed(() => user.value?.status === 'pending');
  const isDenied = computed(() => user.value?.status === 'denied');

  // Actions
  async function login(username: string, password: string) {
    try {
      error.value = null;
      const response = await api.post(`/auth/login`, {
        username,
        password
      });

      console.log('login response', response.data);
      
      const userData = response.data.user ?? null;

      if (!userData) {
        reset();
        return response.data;
      }

      user.value = userData;
      isAuthInitialized.value = true;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    }
  }

  async function checkAuth() {
    try {
      error.value = null;
      const response = await api.get('/auth/me');
      const userData = response.data.user ?? null;

      if (!userData) {
        reset();
        return;
      }

      user.value = userData;
    } catch (err) {
      reset();
    } finally {
      isAuthInitialized.value = true;
    }
  }

  async function ensureAuthInitialized() {
    if (isAuthInitialized.value) {
      return;
    }

    if (!authInitializationPromise) {
      authInitializationPromise = checkAuth().finally(() => {
        authInitializationPromise = null;
      });
    }

    await authInitializationPromise;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      reset();
    }
  }

  function reset() {
    user.value = null;
    error.value = null;
  }

  return {
    // State
    user,
    error,
    isAuthInitialized,
    // Computed
    isAuthenticated,
    isAdmin,
    isPending,
    isDenied,
    // Actions
    login,
    checkAuth,
    ensureAuthInitialized,
    logout,
    reset
  };
});
