import { Request } from 'express';
import { User } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user: User;
} 