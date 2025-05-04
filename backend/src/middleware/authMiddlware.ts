import { Request, Response, NextFunction } from 'express';
import { User as MyUser } from '../types/user';


export const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  // if (req.isAuthenticated() && req.user?.isAdmin) {
  //   return next();
  // }
  res.status(403).json({ error: 'Forbidden' });
}; 