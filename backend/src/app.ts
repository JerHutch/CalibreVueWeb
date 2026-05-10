import express from 'express';
import type { RequestHandler } from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeAuthController } from './controllers/authController';
import { initializeController as initializeGoogleAuthController } from './controllers/googleAuthController';
import { initializeController as initializeAdminController } from './controllers/adminController';
import { initializeMiddleware as initializeAuthMiddleware } from './middleware/authMiddleware';
import { requestLogger } from './middleware/loggingMiddleware';

export interface AppServices {
  calibreService: CalibreService;
  authService: AuthService;
}

export function createApp({ calibreService, authService }: AppServices) {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(requestLogger);
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'development-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }) as unknown as RequestHandler;

  app.use(sessionMiddleware);
  app.use(passport.initialize() as unknown as RequestHandler);
  app.use(passport.session() as unknown as RequestHandler);

  initializeBookController(calibreService);
  initializeAuthController(authService);
  initializeGoogleAuthController(authService);
  initializeAdminController(authService);
  initializeAuthMiddleware(authService);

  setupRoutes(app);

  return app;
}
