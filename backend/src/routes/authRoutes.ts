import { Router } from 'express';
import { login, logout, getCurrentUser } from '../controllers/authController';

const router = Router();

// Login route
router.post('/login', login);

// Logout route
router.post('/logout', logout);

// Get current user route
router.get('/me', getCurrentUser);

export default router; 