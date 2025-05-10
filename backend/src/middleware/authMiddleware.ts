import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

let authService: AuthService;

export const initializeMiddleware = (service: AuthService) => {
  authService = service;
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await authService.getUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Attach user to request object for use in route handlers
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
} 