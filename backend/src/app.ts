import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import {
  initializeGoogleStrategy,
  initializePassportSession
} from './controllers/googleAuthController';
import { initializeController as initializeAdminController } from './controllers/adminController';
import { requestLogger } from './middleware/loggingMiddleware';
import { createRateLimiter } from './middleware/rateLimiter';
import { sessionContext, attachUserToContext } from './middleware/sessionContext';

export interface AppServices {
  calibreService: CalibreService;
  authService: AuthService;
}

export interface CreateAppOptions {
  // Test-only switch for route integration coverage that does not exercise OAuth routes.
  enableGoogleAuth?: boolean;
  // Test-only authenticated user injection using Passport's req.login/session flow.
  testAuthUser?: Express.User;
}

export function createApp(
  { calibreService, authService }: AppServices,
  options: CreateAppOptions = {}
) {
  const app = express();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const useSecureCookies = frontendUrl.startsWith('https://');

  // Production deployments can terminate TLS in a reverse proxy. Trust its
  // forwarded protocol only when this app is configured for an HTTPS frontend.
  if (useSecureCookies) {
    app.set('trust proxy', 1);
  }

  app.use(cors({
    origin: frontendUrl,
    credentials: true
  }));
  // Public log endpoint: rate limit first, then a small body limit, both before
  // the global parser (body-parser skips bodies that are already parsed).
  app.use('/api/client-logs', createRateLimiter({ windowMs: 60000, max: 60 }));
  app.use('/api/client-logs', express.json({ limit: '16kb' }));
  // Answer parser failures (400 malformed, 413 too large) here so Express's
  // default handler never prints the error, which can quote the offending body.
  app.use('/api/client-logs', (
    err: { status?: number; statusCode?: number },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const status = err.status ?? err.statusCode ?? 400;
    const safeStatus = status === 413 ? 413 : 400;
    res.status(safeStatus).json({
      error: safeStatus === 413 ? 'Payload too large' : 'Invalid log payload'
    });
  });
  app.use(express.json());
  app.use(sessionContext);
  app.use(requestLogger);
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: useSecureCookies,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(attachUserToContext);
  initializePassportSession(authService);
  const { testAuthUser } = options;
  if (testAuthUser) {
    app.use((req, _res, next) => {
      req.login(testAuthUser, (error) => {
        if (error) {
          return next(error);
        }

        attachUserToContext(req, _res, next);
      });
    });
  }

  initializeBookController(calibreService);
  if (options.enableGoogleAuth !== false) {
    initializeGoogleStrategy(authService);
  }
  initializeAdminController(authService);

  setupRoutes(app);

  return app;
}
