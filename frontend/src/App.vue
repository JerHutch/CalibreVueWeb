<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

const isAuthenticated = computed(() => authStore.isAuthenticated);
const isAdmin = computed(() => authStore.isAdmin);
const user = computed(() => authStore.user);

const logout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="app">
    <header class="header">
      <nav class="nav">
        <router-link to="/books">Books</router-link>
        <router-link to="/admin" v-if="isAdmin">Admin</router-link>
      </nav>
      <div class="auth">
        <template v-if="isAuthenticated">
          <span class="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">{{ user?.displayName || user?.username }}</span>
          <button @click="logout" class="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300">Logout</button>
        </template>
        <template v-else>
          <!-- No Login button -->
        </template>
      </div>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>



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