import { Router } from 'express';
import { bookRoutes } from './books';
import { authRoutes } from './auth';
import { adminRoutes } from './admin';

export function setupRoutes(app: any) {
  const router = Router();

  // API routes
  router.use('/books', bookRoutes);
  router.use('/admin', adminRoutes);

  app.use('/api', router);
} 