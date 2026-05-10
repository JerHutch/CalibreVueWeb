import { Request, Response } from 'express';
import { User } from '../services/authService';
import logger from '../utils/logger';

export const logout = async (req: Request, res: Response) => {
  if (typeof req.logout === 'function') {
    const logoutError = await new Promise<Error | undefined>((resolve) => {
      req.logout((error) => {
        if (error) {
          logger.error(`Logout error: ${error}`);
        }
        resolve(error);
      });
    });

    if (logoutError) {
      return res.status(500).json({ error: 'Logout failed' });
    }
  }

  if (req.session && typeof req.session.destroy === 'function') {
    const destroyError = await new Promise<Error | undefined>((resolve) => {
      req.session.destroy((error) => {
        if (error) {
          logger.error(`Session destroy error: ${error}`);
        }
        resolve(error);
      });
    });

    if (destroyError) {
      return res.status(500).json({ error: 'Logout failed' });
    }
  }

  return res.json({ message: 'Logged out successfully' });
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
