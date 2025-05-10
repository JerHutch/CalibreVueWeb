import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  // Actions
  async function login(username: string, password: string) {
    try {
      error.value = null;
      const response = await api.post('/auth/login', {
        username,
        password
      });

      console.log('login response', response.data);
      
      const { user: userData, token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('auth_token', token);
      
      // Set user data
      user.value = userData;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    }
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

  async function checkAuth() {
    try {
      const response = await api.get('/auth/me');
      user.value = response.data;
    } catch (err) {
      reset();
    }
  }

  function reset() {
    user.value = null;
    error.value = null;
    localStorage.removeItem('auth_token');
  }

  return {
    // State
    user,
    error,
    // Computed
    isAuthenticated,
    isAdmin,
    // Actions
    login,
    logout,
    checkAuth,
    reset
  };
}); 