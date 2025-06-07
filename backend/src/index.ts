import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import passport from 'passport';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeAuthController } from './controllers/authController';
import { initializeController as initializeGoogleAuthController } from './controllers/googleAuthController';
import { initializeController as initializeAdminController } from './controllers/adminController';
import { requestLogger } from './middleware/loggingMiddleware';
import Database from 'better-sqlite3';

// Load environment variables from .development.env
dotenv.config({ path: path.join(__dirname, '..', '.development.env') });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);

// configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Initialize services
const calibreDbPath = process.env.CALIBRE_DB_PATH || 'bob.db';
const calibreDb = new Database(calibreDbPath, { fileMustExist: true });
const appDb = new Database(process.env.APP_DB_PATH || 'app.db');
const calibreService = new CalibreService(calibreDb, calibreDbPath);
const authService = new AuthService(appDb);

// Initialize controllers and middleware
initializeBookController(calibreService);
initializeAuthController(authService);
initializeGoogleAuthController(authService);
initializeAdminController(authService);

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 