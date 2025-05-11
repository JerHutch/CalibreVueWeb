import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/books',
      name: 'books',
      component: () => import('@/views/BooksView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/books/:id',
      name: 'book-details',
      component: () => import('@/views/BookDetailsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    {
      path: '/pending',
      name: 'pending',
      component: () => import('@/views/PendingView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
});

// Add error handling for navigation
router.onError((error) => {
  console.error('Router error:', error);
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' });
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next({ name: 'books' });
  } else {
    next();
  }
});

export default router; 