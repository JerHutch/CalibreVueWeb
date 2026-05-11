import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from 'passport';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeGoogleAuthController } from './controllers/googleAuthController';
import { initializeController as initializeAdminController } from './controllers/adminController';
import { requestLogger } from './middleware/loggingMiddleware';

export interface AppServices {
  calibreService: CalibreService;
  authService: AuthService;
}

export interface CreateAppOptions {
  testAuthUser?: Express.User;
}

export function createApp(
  { calibreService, authService }: AppServices,
  options: CreateAppOptions = {}
) {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(requestLogger);
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  if (options.testAuthUser) {
    app.use((req, _res, next) => {
      req.user = options.testAuthUser;
      req.isAuthenticated = (() => true) as typeof req.isAuthenticated;
      next();
    });
  }

  initializeBookController(calibreService);
  initializeGoogleAuthController(authService);
  initializeAdminController(authService);

  setupRoutes(app);

  return app;
}
