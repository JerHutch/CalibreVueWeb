<template>
  <div class="home">
    <h1>Welcome to Calibre Web Interface</h1>
    <p>A web-based interface for your Calibre eBook library</p>
    <div v-if="!isAuthenticated" class="auth-prompt">
      <p>Please log in to access your library</p>
      <button @click="login">Login</button>
    </div>
    <div v-else class="library-info">
      <p>You have access to {{ bookCount }} books in your library</p>
      <router-link to="/books" class="button">Browse Library</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);
const bookCount = computed(() => 0); // TODO: Implement book count

const login = () => {
  authStore.login('google'); // Default to Google OAuth
};
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 2rem;
}

.auth-prompt,
.library-info {
  margin-top: 2rem;
  padding: 2rem;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.button {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: #2c3e50;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  margin-top: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background-color: #2c3e50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #34495e;
}
</style> 