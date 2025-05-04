import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { findOrCreateUser } from '../services/userService';
import { authenticateUser } from '../middleware/authMiddlware';
import { sendApprovalEmail } from '../services/email';

const router = Router();

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: '/api/auth/google/callback',
      scope: ['profile']
    },
    async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: Express.User) => void) => {
      try {
        const user = await findOrCreateUser({
          id: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value || '',
          isAdmin: false,
          isApproved: false
        });
        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// GitHub Strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: '/api/auth/github/callback'
    },
    async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: Express.User) => void) => {
      try {
        const user = await findOrCreateUser({
          id: profile.id,
          name: profile.displayName || profile.username,
          email: profile.emails?.[0]?.value || '',
          isAdmin: false,
          isApproved: false
        });
        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }
  )
); 

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
    // if (!req.user.isApproved) {
    //   await sendApprovalEmail(req.user);
    //   return res.redirect('/pending');
    // }

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
    // if (!req.user.isApproved) {
    //   await sendApprovalEmail(req.user);
    //   return res.redirect('/pending');
    // }

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