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
const envFile = process.env.NODE_ENV === 'production' ? '.prod.env' : '.development.env';
dotenv.config({ path: envFile });

// Log all environment variables
console.log('Environment Variables:');
console.log('---------------------');
Object.keys(process.env).forEach(key => {
    // Mask sensitive values
    const value = ['SESSION_SECRET', 'GOOGLE_CLIENT_SECRET'].includes(key) 
        ? '********' 
        : process.env[key];
    console.log(`${key}: ${value}`);
});
console.log('---------------------');

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
const calibreDbDir = './data';
const calibreDbName = process.env.CALIBRE_DB_NAME || 'bob.db';
const calibreDbPath = path.join(calibreDbDir, calibreDbName);

try {
  console.log(`Attempting to connect to Calibre database at: ${calibreDbPath}`);
  const calibreDb = new Database(calibreDbPath, { fileMustExist: true });
  console.log('Successfully connected to Calibre database');
  
  console.log(`Attempting to connect to application database at: ${process.env.APP_DB_PATH || 'app.db'}`);
  const appDb = new Database(process.env.APP_DB_PATH || 'app.db');
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
  console.log(`Server is running on port ${port}`);
}); 