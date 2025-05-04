import { Router } from 'express';
import { authenticateAdmin } from '../middleware/authMiddlware';
import { updateUser } from '../services/userService';
import { db } from '../database';

const router = Router();

// Get all pending users
router.get('/pending', authenticateAdmin, async (req, res) => {
  try {
    const pendingUsers = await db.all(
      'SELECT * FROM users WHERE isApproved = 0 ORDER BY createdAt DESC'
    );
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

// Approve user
router.post('/approve/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await updateUser(id, { isApproved: true });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject user
router.post('/reject/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

export const adminRoutes = router; 