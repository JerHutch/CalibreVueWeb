import dotenv from 'dotenv';
import path from 'path';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { createApp } from './app';
import logger from './utils/logger';
import Database from 'better-sqlite3';
import { initializeAppSchema } from './db/appSchema';

// Load environment variables from .development.env
const envFile = process.env.NODE_ENV === 'production' ? '.prod.env' : '.development.env';
dotenv.config({ path: envFile });

logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
logger.info(`PORT: ${process.env.PORT || 3000}`);
logger.info(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
logger.info(`CALIBRE_DB_NAME: ${process.env.CALIBRE_DB_NAME || 'metadata.db'}`);
logger.info(`APP_DB_PATH: ${process.env.APP_DB_PATH || '/usr/src/app/data/app/app.db'}`);

const port = process.env.PORT || 3000;

// Initialize services
const calibreDbDir = process.env.CALIBRE_DB_DIR || '/usr/src/app/data/calibre';
const calibreDbName = process.env.CALIBRE_DB_NAME || 'metadata.db';
const calibreDbPath = path.join(calibreDbDir, calibreDbName);
const appDbPath = process.env.APP_DB_PATH || '/usr/src/app/data/app/app.db';

try {
  console.log(`Attempting to connect to Calibre database at: ${calibreDbPath}`);
  const calibreDb = new Database(calibreDbPath, { fileMustExist: true });
  console.log('Successfully connected to Calibre database');
  
  console.log(`Attempting to connect to application database at: ${appDbPath}`);
  const appDb = new Database(appDbPath);
  initializeAppSchema(appDb);
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
