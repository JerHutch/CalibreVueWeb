<template>
  <div class="app">
    <header class="header">
      <nav class="nav">
        <router-link to="/">Home</router-link>
        <router-link to="/books">Books</router-link>
        <router-link to="/admin" v-if="isAdmin">Admin</router-link>
      </nav>
      <div class="auth">
        <template v-if="isAuthenticated">
          <span>{{ user?.name }}</span>
          <button @click="logout">Logout</button>
        </template>
        <template v-else>
          <button @click="login">Login</button>
        </template>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const isAuthenticated = computed(() => authStore.isAuthenticated);
const isAdmin = computed(() => authStore.isAdmin);
const user = computed(() => authStore.user);

const login = () => {
  // TODO: Implement OAuth login
};

const logout = () => {
  authStore.logout();
  router.push('/');
};
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #2c3e50;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav {
  display: flex;
  gap: 1rem;
}

.nav a {
  color: white;
  text-decoration: none;
}

.auth {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.main {
  flex: 1;
  padding: 2rem;
}
</style> 