<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '@/api/axios';

interface PendingUser {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  picture?: string;
  status: string;
}

const pendingUsers = ref<PendingUser[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const processingUser = ref<number | null>(null);

const fetchPendingUsers = async () => {
  try {
    loading.value = true;
    error.value = null;
    const response = await api.get('/admin/pending-users');
    pendingUsers.value = response.data;
  } catch (err) {
    error.value = 'Failed to fetch pending users';
    console.error('Error fetching pending users:', err);
  } finally {
    loading.value = false;
  }
};

const approveUser = async (userId: number) => {
  try {
    processingUser.value = userId;
    await api.post(`/admin/users/${userId}/approve`);
    await fetchPendingUsers(); // Refresh the list
  } catch (err) {
    error.value = 'Failed to approve user';
    console.error('Error approving user:', err);
  } finally {
    processingUser.value = null;
  }
};

const denyUser = async (userId: number) => {
  try {
    processingUser.value = userId;
    await api.post(`/admin/users/${userId}/deny`);
    await fetchPendingUsers(); // Refresh the list
  } catch (err) {
    error.value = 'Failed to deny user';
    console.error('Error denying user:', err);
  } finally {
    processingUser.value = null;
  }
};

onMounted(fetchPendingUsers);
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">Admin Dashboard</h1>
    
    <!-- Pending Users Section -->
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Pending User Approvals</h2>
      
      <div v-if="loading" class="flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
      
      <div v-else-if="error" class="text-red-500 mb-4">
        {{ error }}
      </div>
      
      <div v-else-if="pendingUsers.length === 0" class="text-gray-500">
        No pending users to review.
      </div>
      
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="user in pendingUsers" :key="user.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <img v-if="user.picture" :src="user.picture" :alt="user.displayName" class="h-10 w-10 rounded-full">
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ user.displayName || user.username }}</div>
                    <div class="text-sm text-gray-500">ID: {{ user.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ user.email }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  @click="approveUser(user.id)"
                  class="text-green-600 hover:text-green-900 mr-4"
                  :disabled="processingUser === user.id"
                >
                  <span v-if="processingUser === user.id" class="animate-spin inline-block h-4 w-4 mr-1">⟳</span>
                  Approve
                </button>
                <button
                  @click="denyUser(user.id)"
                  class="text-red-600 hover:text-red-900"
                  :disabled="processingUser === user.id"
                >
                  <span v-if="processingUser === user.id" class="animate-spin inline-block h-4 w-4 mr-1">⟳</span>
                  Deny
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>



<style scoped>
.admin-view {
  padding: 2rem;
}

.admin-content {
  margin-top: 2rem;
}
</style> 