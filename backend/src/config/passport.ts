import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { User } from '../types/user';
import { findOrCreateUser } from '../services/user';

passport.serializeUser((user: User, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await findOrCreateUser({ id });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: '/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
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
    async (accessToken, refreshToken, profile, done) => {
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