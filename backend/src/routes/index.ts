import { Router } from 'express';
import { Application } from 'express';
import bookRoutes from './bookRoutes';
import authRoutes from './authRoutes';
import googleAuthRoutes from './googleAuthRoutes';
import adminRoutes from './adminRoutes';
import clientLogRoutes from './clientLogRoutes';
import { authenticateToken } from '../middleware/authMiddleware';

export const setupRoutes = (app: Application) => {
  const router = Router();
  
  // Public auth routes
  router.use('/auth/google', googleAuthRoutes);
  router.use('/auth', authRoutes);
  // Public: browsers report errors even when not signed in.
  router.use('/client-logs', clientLogRoutes);
  
  // Protected routes
  router.use(authenticateToken);
  router.use('/books', bookRoutes);
  router.use('/admin', adminRoutes);
  
  // Mount all routes under /api
  app.use('/api', router);
}; 