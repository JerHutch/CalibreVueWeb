import { Router } from 'express';
import { Application } from 'express';
import bookRoutes from './bookRoutes';

export const setupRoutes = (app: Application) => {
  const router = Router();
  
  // Mount book routes
  router.use('/books', bookRoutes);
  
  // Mount all routes under /api
  app.use('/api', router);
}; 