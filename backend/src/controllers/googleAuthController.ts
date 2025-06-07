import passport from 'passport';
import { AuthService } from '../services/authService';
import { Request, Response } from 'express';

const GoogleStrategy = require('passport-google-oauth20').Strategy;

let authService: AuthService;

export function initializeController(authService: AuthService) {
    // Configure passport serialization
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
        try {
            const user = await authService.getUserById(id.toString());
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    },
        async function(accessToken: string, refreshToken: string, profile: any, done: any) {
            const user = await authService.findOrCreateUser(profile);
            console.log('user', user);
            if (user) {
                if (user.status === 'pending') {
                    return done(null, false, { message: 'Your account is pending approval by an administrator.' });
                }
                if (user.status === 'denied') {
                    return done(null, false, { message: 'Your account has been denied access.' });
                }
                done(null, user);
            } else {
                done(null, false);
            }
        }
    ));
}

export function authenticateGoogle() {
    return passport.authenticate('google', { scope: ['profile', 'email'] });
}

export function handleGoogleCallback() {
    var baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return passport.authenticate('google', { 
        failureRedirect: `${baseUrl}/pending`,
        failureMessage: true
    });
}

export function redirectAfterAuth(req: Request, res: Response) {
    var baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    var redirectUrl = `${baseUrl}/auth/google/callback`;
    res.redirect(redirectUrl);
}
