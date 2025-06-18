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
  <div class="admin-bg min-h-screen py-10 px-2 sm:px-0">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-3xl font-extrabold text-center mb-6 text-gray-800 tracking-tight">Admin Dashboard</h1>
      <div class="bg-white/90 rounded-2xl shadow-xl p-8 border border-gray-200">
        <h2 class="text-2xl font-bold text-gray-700">Pending User Approvals</h2>
        <div v-if="loading" class="flex justify-center py-8">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
        <div v-else-if="error" class="text-red-500 mb-4 text-center font-semibold">
          {{ error }}
        </div>
        <div v-else-if="pendingUsers.length === 0" class="text-gray-500 text-center py-8">
          No pending users to review.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden border border-gray-200">
            <tbody class="bg-white divide-y divide-gray-100">
              <tr v-for="user in pendingUsers" :key="user.id" class="hover:bg-blue-50/40 transition">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="h-12 w-12 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500 overflow-hidden">
                      <img v-if="user.picture" :src="user.picture" :alt="user.displayName || user.username" class="h-12 w-12 object-cover rounded-full" />
                      <span v-else>{{ (user.displayName || user.username).split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) }}</span>
                    </div>
                    <div class="ml-4">
                      <div class="text-base font-semibold text-gray-900">{{ user.displayName || user.username }}</div>
                      <div class="text-xs text-gray-400">ID: {{ user.id }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-base text-gray-800">{{ user.email }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-base font-medium flex gap-2">
                  <button
                    @click="approveUser(user.id)"
                    class="rounded-lg px-4 py-2 bg-green-500 text-white font-semibold shadow hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="processingUser === user.id"
                  >
                    <span v-if="processingUser === user.id" class="animate-spin inline-block h-4 w-4 mr-1 align-middle">⟳</span>
                    Approve
                  </button>
                  <button
                    @click="denyUser(user.id)"
                    class="rounded-lg px-4 py-2 bg-red-500 text-white font-semibold shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="processingUser === user.id"
                  >
                    <span v-if="processingUser === user.id" class="animate-spin inline-block h-4 w-4 mr-1 align-middle">⟳</span>
                    Deny
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-bg {
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%);
  min-height: 100vh;
}
</style> 