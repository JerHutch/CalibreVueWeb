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

  logger.info('User logged out', { event: 'auth.logout' });
  return res.json({ message: 'Logged out successfully' });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated() || !req.user) {
      logger.info('Session check: not authenticated', {
        event: 'auth.session.check',
        details: { authenticated: false }
      });
      return res.json({ authenticated: false });
    }

    const user = req.user as User;
    logger.info(`Session check: user ${user.id} is ${user.status}`, {
      event: 'auth.session.check',
      userId: String(user.id),
      details: { authenticated: user.status === 'approved', status: user.status }
    });

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
