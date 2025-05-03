import { Router } from 'express';
import passport from 'passport';
import { authenticateUser } from '../middleware/auth';
import { sendApprovalEmail } from '../services/email';

const router = Router();

// OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

// OAuth callback routes
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    if (!req.user) {
      return res.redirect('/login');
    }

    // Check if user needs approval
    if (!req.user.isApproved) {
      await sendApprovalEmail(req.user);
      return res.redirect('/pending');
    }

    res.redirect('/');
  }
);

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  async (req, res) => {
    if (!req.user) {
      return res.redirect('/login');
    }

    // Check if user needs approval
    if (!req.user.isApproved) {
      await sendApprovalEmail(req.user);
      return res.redirect('/pending');
    }

    res.redirect('/');
  }
);

// Get current user
router.get('/me', authenticateUser, (req, res) => {
  res.json(req.user);
});

// Logout
router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

export const authRoutes = router; 