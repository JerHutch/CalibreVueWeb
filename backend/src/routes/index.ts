import { Router } from 'express';
import { Application } from 'express';
import bookRoutes from './bookRoutes';
import authRoutes from './authRoutes';
import googleAuthRoutes from './googleAuthRoutes';
import { authenticateToken } from '../middleware/authMiddleware';

export const setupRoutes = (app: Application) => {
  const router = Router();
  
  // Public auth routes
  router.use('/auth/google', googleAuthRoutes);
  router.use('/auth', authRoutes);
  
  
  // Protected routes
  router.use(authenticateToken);
  router.use('/books', bookRoutes);
  
  // Mount all routes under /api
  app.use('/api', router);
}; 