import { Request, Response, NextFunction } from 'express';
import { AuthService, User } from '../services/authService';
import logger from '../utils/logger';

let authService: AuthService | undefined;

export const initializeMiddleware = (service: AuthService) => {
  authService = service;
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user) {
      const user = req.user as User;

      if (user.status !== 'approved') {
        return res.status(403).json({ error: 'Account is not approved', status: user.status });
      }

      return next();
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    logger.error(`Authentication error: ${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
