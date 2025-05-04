import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue')
    },
    // {
    //   path: '/books',
    //   name: 'books',
    //   component: () => import('@/views/BooksView.vue'),
    //   meta: { requiresAuth: true }
    // },
    // {
    //   path: '/books/:id',
    //   name: 'book-details',
    //   component: () => import('@/views/BookDetailsView.vue'),
    //   meta: { requiresAuth: true }
    // },
    // {
    //   path: '/admin',
    //   name: 'admin',
    //   component: () => import('@/views/AdminView.vue'),
    //   meta: { requiresAuth: true, requiresAdmin: true }
    // },
    // {
    //   path: '/login',
    //   name: 'login',
    //   component: () => import('@/views/LoginView.vue')
    // },
    // {
    //   path: '/pending',
    //   name: 'pending',
    //   component: () => import('@/views/PendingView.vue')
    // }
  ]
});

// 'from' parameter might be needed for future navigation logic
router.beforeEach((to) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'home' }
  } 
});

export default router; 