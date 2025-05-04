import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import { setupRoutes } from './routes';


dotenv.config();

var sqliteStore = require('connect-sqlite3')(session);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());


// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new sqliteStore({
    db: process.env.DB_FILENAME || ':memory:'
  })
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Setup routes and middleware
setupRoutes(app);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 