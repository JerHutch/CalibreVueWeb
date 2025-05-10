import { defineStore } from 'pinia';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false
  }),

  actions: {
    async login(provider: string) {
      try {
        // TODO: Implement OAuth login
        // This will redirect to the OAuth provider
        // window.location.href = `/api/auth/${provider}`;
        
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },

    async logout() {
      try {
        await axios.post('/api/auth/logout');
        this.$reset();
      } catch (error) {
        console.error('Logout failed:', error);
        throw error;
      }
    },

    async checkAuth() {
      try {
        const response = await axios.get('/api/auth/me');
        this.user = response.data;
        this.isAuthenticated = true;
        this.isAdmin = response.data.isAdmin;
      } catch (error) {
        this.$reset();
      }
    }
  }
}); 