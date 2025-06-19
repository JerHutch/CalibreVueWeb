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
import logger from './utils/logger';
import Database from 'better-sqlite3';

// Load environment variables from .development.env
const envFile = process.env.NODE_ENV === 'production' ? '.prod.env' : '.development.env';
dotenv.config({ path: envFile });

// Log all environment variables
logger.info('Environment Variables:');
logger.info('---------------------');
Object.keys(process.env).forEach(key => {
    // Mask sensitive values
    const value = ['SESSION_SECRET', 'GOOGLE_CLIENT_SECRET'].includes(key) 
        ? '********' 
        : process.env[key];
    logger.info(`${key}: ${value}`);
});
logger.info('---------------------');

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
const calibreDbDir = './calibre';
const calibreDbName = process.env.CALIBRE_DB_NAME || 'bob.db';
const calibreDbPath = path.join(calibreDbDir, calibreDbName);

try {
  console.log(`Attempting to connect to Calibre database at: ${calibreDbPath}`);
  const calibreDb = new Database(calibreDbPath, { fileMustExist: true });
  console.log('Successfully connected to Calibre database');
  
  console.log(`Attempting to connect to application database at: ${process.env.APP_DB_FILENAME || 'app.db'}`);
  const appDbPath = path.join('data', process.env.APP_DB_FILENAME || 'app.db');
  const appDb = new Database(appDbPath);
  console.log('Successfully connected to application database');

  const calibreService = new CalibreService(calibreDb, calibreDbPath);
  const authService = new AuthService(appDb);

  // Initialize controllers and middleware
  initializeBookController(calibreService);
  initializeAuthController(authService);
  initializeGoogleAuthController(authService);
  initializeAdminController(authService);
} catch (error) {
  console.error('Failed to initialize databases:', error);
  process.exit(1);
}

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
