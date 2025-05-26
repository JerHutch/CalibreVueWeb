<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div v-if="loading" class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      <div v-else-if="error" class="text-red-500">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    // Check authentication status
    await authStore.checkAuth();
    
    // Redirect to books page if authenticated
    if (authStore.isAuthenticated) {
      router.push({ name: 'books' });
    } else {
      error.value = 'Authentication failed';
    }
  } catch (err) {
    error.value = 'Failed to authenticate';
    console.error('Authentication error:', err);
  } finally {
    loading.value = false;
  }
});
</script> 