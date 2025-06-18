import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import logger from '../utils/logger';

let authService: AuthService;

export const initializeMiddleware = (service: AuthService) => {
  authService = service;
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for session-based auth first (Passport)
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
      return next();
    }
 
  } catch (error) {
    logger.error(`Authentication error: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      isAuthenticated?(): boolean;
    }
  }
} 