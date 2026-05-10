import dotenv from 'dotenv';
import path from 'path';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { createApp } from './app';
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

const port = process.env.PORT || 3000;

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
  const app = createApp({ calibreService, authService });

  app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
  });
} catch (error) {
  console.error('Failed to initialize databases:', error);
  process.exit(1);
}
