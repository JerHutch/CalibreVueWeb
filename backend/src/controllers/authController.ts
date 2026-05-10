import { Request, Response } from 'express';
import { AuthService, User } from '../services/authService';
import logger from '../utils/logger';

let authService: AuthService;

export const initializeController = (service: AuthService) => {
  authService = service;
};

export const logout = async (req: Request, res: Response) => {
  if (typeof req.logout === 'function') {
    await new Promise<void>((resolve) => {
      req.logout((error) => {
        if (error) {
          logger.error(`Logout error: ${error}`);
        }
        resolve();
      });
    });
  }

  if (req.session && typeof req.session.destroy === 'function') {
    await new Promise<void>((resolve) => {
      req.session.destroy((error) => {
        if (error) {
          logger.error(`Session destroy error: ${error}`);
        }
        resolve();
      });
    });
  }

  res.json({ message: 'Logged out successfully' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated() || !req.user) {
      return res.json({ authenticated: false });
    }

    const user = req.user as User;

    return res.json({
      authenticated: user.status === 'approved',
      user,
      status: user.status
    });
  } catch (error) {
    logger.error(`Get current user error: ${error}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
