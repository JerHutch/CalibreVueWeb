import { Router } from 'express';
import { logout, getCurrentUser } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Get current user route
router.get('/me', getCurrentUser);

// Protected routes
router.use(authenticateToken);

// Logout route
router.post('/logout', logout);

export default router;
