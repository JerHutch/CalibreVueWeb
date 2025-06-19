import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import logger from '../utils/logger';

let authService: AuthService;

export const initializeController = (service: AuthService) => {
  authService = service;
};

export const logout = (req: Request, res: Response) => {
  // Since we're using JWT, we don't need to do anything server-side
  // The client should remove the token
  res.json({ message: 'Logged out successfully' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // If using session-based auth (Passport)
    if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
      const user = req.user as any;
      // If user is pending, return a special response
      if (user.status === 'pending') {
        return res.json({
          status: 'pending',
          message: 'Your account is pending approval by an administrator.',
          user: {
            id: user.id,
            email: user.email,
            status: user.status
          }
        });
      }
      return res.json(user);
    }
    
    // If using token-based auth
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

    // If user is pending, return a special response
    if (user.status === 'pending') {
      return res.json({
        status: 'pending',
        message: 'Your account is pending approval by an administrator.',
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        }
      });
    }

    res.json(user);
  } catch (error) {
    logger.error(`Get current user error: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};
