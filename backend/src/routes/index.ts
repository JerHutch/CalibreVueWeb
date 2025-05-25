import { Router } from 'express';
import { Application } from 'express';
import bookRoutes from './bookRoutes';
// import authRoutes from './authRoutes';
import googleAuthRoutes from './googleAuthRoutes';

export const setupRoutes = (app: Application) => {
  const router = Router();
  
  // Mount auth routes
  //router.use('/auth', authRoutes);
  router.use('/auth', googleAuthRoutes);
  // Mount book routes
  router.use('/books', bookRoutes);
  
  // Mount all routes under /api
  app.use('/api', router);
}; 