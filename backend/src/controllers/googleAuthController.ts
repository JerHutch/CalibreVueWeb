import passport from 'passport';
import { AuthService } from '../services/authService';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';
import { getContext } from '../utils/requestContext';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.prod.env' : '.development.env';
dotenv.config({ path: envFile });

const GoogleStrategy = require('passport-google-oauth20').Strategy;

let authService: AuthService;

export function initializePassportSession(authService: AuthService) {
    logger.info('Initializing passport session support...');

    // Configure passport serialization
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: number, done) => {
        try {
            const user = await authService.getUserById(id.toString());
            done(null, user);
        } catch (error) {
            logger.error(`Error deserializing user: ${error}`);
            done(error, null);
        }
    });
}

function setContextUserId(userId: unknown) {
    const ctx = getContext();
    if (ctx && userId !== undefined && userId !== null) {
        ctx.userId = String(userId);
    }
}

export function initializeGoogleStrategy(authService: AuthService) {
    logger.info('Setting up Google Strategy...');
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/google/callback`
    },
        async function(accessToken: string, refreshToken: string, profile: any, done: any) {
            logger.info('Google OAuth profile received');
            const user = await authService.findOrCreateUser(profile);

            if (user) {
                setContextUserId(user.id);
                logger.info(`User lookup/creation succeeded for user ${user.id}`);
                if (user.status === 'pending') {
                    logger.info(`User ${user.id} attempted to login but account is pending approval`);
                    return done(null, false, {
                        status: 'pending',
                        message: 'Your account is pending approval by an administrator.'
                    });
                }
                if (user.status === 'denied') {
                    logger.info(`User ${user.id} attempted to login but account is denied`);
                    return done(null, false, {
                        status: 'denied',
                        message: 'Your account has been denied access.'
                    });
                }
                logger.info(`Successfully authenticated user ${user.id}`);
                done(null, user);
            } else {
                logger.info('User lookup/creation returned no user; authentication failed');
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
    const authenticate = passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: true
    } as any);

    return (req: Request, res: Response, next: any) => {
        logger.info('Starting Google sign-in', { event: 'auth.google.start' });
        return authenticate(req, res, next);
    };
}

const MAX_GOOGLE_ERROR_LENGTH = 100;

function readGoogleError(req: Request): string | undefined {
    const value = req.query?.error;
    if (typeof value !== 'string' || value.length === 0) {
        return undefined;
    }
    return value.slice(0, MAX_GOOGLE_ERROR_LENGTH);
}

export function handleGoogleCallback() {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackUrl = `${baseUrl}/auth/google/callback`;
    const errorRedirectUrl = `${callbackUrl}?status=error`;

    return (req: Request, res: Response, next: any) => {
        const googleError = readGoogleError(req);
        logger.info('Google sign-in callback received', {
            event: 'auth.google.callback',
            details: googleError ? { googleError } : {}
        });

        passport.authenticate('google', {}, (error: unknown, user: Express.User | false, info?: { status?: string }) => {
            if (error) {
                const description = error instanceof Error ? `${error.name}: ${error.message}` : 'non-error value';
                logger.error(`Google sign-in failed in passport: ${description}`, {
                    event: 'auth.google.outcome',
                    details: { status: 'error', reason: 'passport_error' }
                });
                return res.redirect(errorRedirectUrl);
            }

            if (!user) {
                const status = info?.status === 'pending' || info?.status === 'denied'
                    ? info.status
                    : undefined;
                logger.warn(`Google sign-in not completed: ${status ?? 'no user'}`, {
                    event: 'auth.google.outcome',
                    details: { status: status ?? 'no_user' }
                });
                const redirectUrl = status ? `${callbackUrl}?status=${status}` : callbackUrl;
                return res.redirect(redirectUrl);
            }

            const userId = String((user as { id?: unknown }).id);
            setContextUserId(userId);

            req.logIn(user, (loginError) => {
                if (loginError) {
                    const description = loginError instanceof Error ? `${loginError.name}: ${loginError.message}` : 'non-error value';
                    logger.error(`Google sign-in session creation failed: ${description}`, {
                        event: 'auth.google.outcome',
                        userId,
                        details: { status: 'error', reason: 'login_failed' }
                    });
                    return res.redirect(errorRedirectUrl);
                }

                logger.info('Google sign-in approved', {
                    event: 'auth.google.outcome',
                    userId,
                    details: { status: 'approved' }
                });
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
