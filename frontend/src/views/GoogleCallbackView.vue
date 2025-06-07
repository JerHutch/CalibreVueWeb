<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div v-if="loading" class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      <div v-else-if="error" class="text-red-500">{{ error }}</div>
      <div v-else-if="authStore.isPending" class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-4">Account Pending Approval</h2>
        <p class="text-gray-600 mb-4">
          Your account is currently pending approval by an administrator. 
          You will be notified once your account has been approved.
        </p>
        <button 
          @click="authStore.logout" 
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Return to Login
        </button>
      </div>
      <div v-else-if="authStore.isDenied" class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-4">Access Denied</h2>
        <p class="text-gray-600 mb-4">
          Your account has been denied access to the application. 
          Please contact the administrator if you believe this is an error.
        </p>
        <button 
          @click="authStore.logout" 
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Return to Login
        </button>
      </div>
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
    
    // Handle different user statuses
    if (authStore.isAuthenticated) {
      router.push({ name: 'books' });
    } else if (!authStore.isPending && !authStore.isDenied) {
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