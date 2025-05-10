import { Router } from 'express';
import { Application } from 'express';
import bookRoutes from './bookRoutes';
import authRoutes from './authRoutes';

export const setupRoutes = (app: Application) => {
  const router = Router();
  
  // Mount auth routes
  router.use('/auth', authRoutes);
  
  // Mount book routes
  router.use('/books', bookRoutes);
  
  // Mount all routes under /api
  app.use('/api', router);
}; 