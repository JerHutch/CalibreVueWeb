import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

interface User {
  id: string;
  name: string;
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
      const response = await axios.post('/api/auth/login', {
        username,
        password
      });
      
      user.value = response.data.user;
      return response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    }
  }

  async function logout() {
    try {
      await axios.post('/api/auth/logout');
      reset();
    } catch (err) {
      console.error('Logout failed:', err);
      throw err;
    }
  }

  async function checkAuth() {
    try {
      const response = await axios.get('/api/auth/me');
      user.value = response.data;
    } catch (err) {
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