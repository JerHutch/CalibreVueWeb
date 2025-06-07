import { Router } from 'express';
import { getPendingUsers, approveUser, denyUser } from '../controllers/adminController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// All admin routes require authentication
router.use(authenticateToken);

// Middleware to check if user is admin
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

// Get all pending users
router.get('/pending-users', getPendingUsers);

// Approve a user
router.post('/users/:userId/approve', approveUser);

// Deny a user
router.post('/users/:userId/deny', denyUser);

export default router; 