import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

const STORAGE_KEY = 'auth_user';

export const useAuthStore = defineStore('auth', () => {
  // Initialize state from localStorage
  const savedUser = localStorage.getItem(STORAGE_KEY);
  const user = ref<User | null>(savedUser ? JSON.parse(savedUser) : null);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  // Actions
  async function login(username: string, password: string) {
    try {
      error.value = null;
      const response = await api.post(`/auth/login`, {
        username,
        password
      });

      console.log('login response', response.data);
      
      const { user: userData, token } = response.data;
      
      // Save token and user data to localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      
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
      const userData = response.data;
      user.value = userData;
      // Update localStorage with fresh user data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } catch (err) {
      reset();
    }
  }

  function reset() {
    user.value = null;
    error.value = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem(STORAGE_KEY);
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