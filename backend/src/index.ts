import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeAuthController } from './controllers/authController';
import { initializeMiddleware } from './middleware/authMiddleware';
import { requestLogger } from './middleware/loggingMiddleware';
import Database from 'better-sqlite3';

// Load environment variables from .development.env
dotenv.config({ path: path.join(__dirname, '..', '.development.env') });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Initialize services
const calibreDbPath = process.env.CALIBRE_DB_PATH || 'bob.db';
const calibreDb = new Database(calibreDbPath, { fileMustExist: true });
const appDb = new Database(process.env.APP_DB_PATH || 'app.db');
const calibreService = new CalibreService(calibreDb, calibreDbPath);
const authService = new AuthService(appDb);

// Initialize controllers and middleware
initializeBookController(calibreService);
initializeAuthController(authService);
initializeMiddleware(authService);

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 