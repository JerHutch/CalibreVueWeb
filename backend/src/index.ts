import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes';
import { setupAuth } from './auth';
import { setupDatabase } from './database';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup routes and middleware
setupAuth(app);
setupRoutes(app);
setupDatabase();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 