import passport from 'passport';
import { AuthService } from '../services/authService';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.development.env') });

const GoogleStrategy = require('passport-google-oauth20').Strategy;

let authService: AuthService;

export function initializeController(authService: AuthService) {
    console.log('Initializing Google Auth Controller...');
    
    // Configure passport serialization
    passport.serializeUser((user: any, done) => {
        console.log(`Serializing user with ID: ${user.id}`);
        done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
        console.log(`Deserializing user with ID: ${id}`);
        try {
            const user = await authService.getUserById(id.toString());
            console.log(`Successfully deserialized user: ${user?.email}`);
            done(null, user);
        } catch (error) {
            console.error('Error deserializing user:', error);
            done(error, null);
        }
    });

    console.log('Setting up Google Strategy...');
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    },
        async function(accessToken: string, refreshToken: string, profile: any, done: any) {
            console.log(`Google OAuth callback received for profile: ${profile.emails?.[0]?.value}`);
            const user = await authService.findOrCreateUser(profile);
            console.log('User lookup/creation result:', user ? `Found user: ${user.email}` : 'No user found');
            
            if (user) {
                if (user.status === 'pending') {
                    console.log(`User ${user.email} attempted to login but account is pending approval`);
                    return done(null, false, { message: 'Your account is pending approval by an administrator.' });
                }
                if (user.status === 'denied') {
                    console.log(`User ${user.email} attempted to login but account is denied`);
                    return done(null, false, { message: 'Your account has been denied access.' });
                }
                console.log(`Successfully authenticated user: ${user.email}`);
                done(null, user);
            } else {
                console.log('Authentication failed - no user found');
                done(null, false);
            }
        }
    ));
}

export function authenticateGoogle() {
    console.log('Initiating Google authentication...');
    return passport.authenticate('google', { scope: ['profile', 'email'] });
}

export function handleGoogleCallback() {
    var baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    console.log('Handling Google OAuth callback... baseUrl', baseUrl);
    return passport.authenticate('google', { 
        failureRedirect: `${baseUrl}/auth/google/callback`,
        failureMessage: true
    });
}

export function redirectAfterAuth(req: Request, res: Response) {
    console.log('Redirecting after successful authentication...');
    var baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    var redirectUrl = `${baseUrl}/auth/google/callback`;
    console.log(`Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
}
