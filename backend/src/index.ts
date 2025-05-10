import express from 'express';
import cors from 'cors';
import { setupRoutes } from './routes';
import { CalibreService } from './services/calibreService';
import { AuthService } from './services/authService';
import { initializeController as initializeBookController } from './controllers/bookController';
import { initializeController as initializeAuthController } from './controllers/authController';
import { Database } from 'sqlite3';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const calibreDb = new Database(process.env.CALIBRE_DB_PATH || 'metadata.db');
const appDb = new Database(process.env.APP_DB_PATH || 'app.db');
const calibreService = new CalibreService(calibreDb);
const authService = new AuthService(appDb);

// Initialize controllers
initializeBookController(calibreService);
initializeAuthController(authService);

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 