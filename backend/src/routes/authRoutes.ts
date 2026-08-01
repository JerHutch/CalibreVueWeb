import { Router } from 'express';
import { logout, getCurrentUser } from '../controllers/authController';
import { authenticateSession, authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Get current user route
router.get('/me', getCurrentUser);

// Logout route
router.post('/logout', authenticateSession, logout);

// Protected routes
router.use(authenticateToken);

export default router;
