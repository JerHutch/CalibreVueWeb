import { Router } from 'express';
import { login, logout, getCurrentUser } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Login route (public)
router.post('/login', login);

// Protected routes
router.use(authenticateToken);

// Logout route
router.post('/logout', logout);

// Get current user route
router.get('/me', getCurrentUser);

export default router; 