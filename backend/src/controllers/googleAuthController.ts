import passport from 'passport';
import { AuthService } from '../services/authService';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.prod.env' : '.development.env';
dotenv.config({ path: envFile });

const GoogleStrategy = require('passport-google-oauth20').Strategy;

let authService: AuthService;

export function initializePassportSession(authService: AuthService) {
    logger.info('Initializing passport session support...');

    // Configure passport serialization
    passport.serializeUser((user: any, done) => {
        logger.info(`Serializing user with ID: ${user.id}`);
        done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
        logger.info(`Deserializing user with ID: ${id}`);
        try {
            const user = await authService.getUserById(id.toString());
            logger.info(`Successfully deserialized user: ${user?.email}`);
            done(null, user);
        } catch (error) {
            logger.error(`Error deserializing user: ${error}`);
            done(error, null);
        }
    });
}

export function initializeGoogleStrategy(authService: AuthService) {
    logger.info('Setting up Google Strategy...');
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/google/callback`
    },
        async function(accessToken: string, refreshToken: string, profile: any, done: any) {
            logger.info(`Google OAuth callback received for profile: ${profile.emails?.[0]?.value}`);
            const user = await authService.findOrCreateUser(profile);
            logger.info('User lookup/creation result:' + (user ? ` Found user: ${user.email}` : ' No user found'));
            
            if (user) {
                if (user.status === 'pending') {
                    logger.info(`User ${user.email} attempted to login but account is pending approval`);
                    return done(null, false, {
                        status: 'pending',
                        message: 'Your account is pending approval by an administrator.'
                    });
                }
                if (user.status === 'denied') {
                    logger.info(`User ${user.email} attempted to login but account is denied`);
                    return done(null, false, {
                        status: 'denied',
                        message: 'Your account has been denied access.'
                    });
                }
                logger.info(`Successfully authenticated user: ${user.email}`);
                done(null, user);
            } else {
                logger.info('Authentication failed - no user found');
                done(null, false);
            }
        }
    ));
}

export function initializeController(authService: AuthService) {
    initializePassportSession(authService);
    initializeGoogleStrategy(authService);
}

export function authenticateGoogle() {
    logger.info('Initiating Google authentication...');
    return passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: true
    } as any);
}

export function handleGoogleCallback() {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackUrl = `${baseUrl}/auth/google/callback`;
    const errorRedirectUrl = `${callbackUrl}?status=error`;
    logger.info('Handling Google OAuth callback... baseUrl ' + baseUrl);

    return (req: Request, res: Response, next: any) => {
        passport.authenticate('google', {}, (error: unknown, user: Express.User | false, info?: { status?: string }) => {
            if (error) {
                logger.error(`Google OAuth callback error: ${error}`);
                return res.redirect(errorRedirectUrl);
            }

            if (!user) {
                const status = info?.status === 'pending' || info?.status === 'denied'
                    ? info.status
                    : undefined;
                const redirectUrl = status ? `${callbackUrl}?status=${status}` : callbackUrl;
                return res.redirect(redirectUrl);
            }

            req.logIn(user, (loginError) => {
                if (loginError) {
                    logger.error(`Google OAuth session creation failed: ${loginError}`);
                    return res.redirect(errorRedirectUrl);
                }

                return next();
            });
        })(req, res, next);
    };
}

export function redirectAfterAuth(req: Request, res: Response) {
    logger.info('Redirecting after successful authentication...');
    var baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    var redirectUrl = `${baseUrl}/auth/google/callback?status=approved`;
    logger.info(`Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
}
