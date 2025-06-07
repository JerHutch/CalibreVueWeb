import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

let authService: AuthService;

export const initializeController = (service: AuthService) => {
  authService = service;
};

export const getPendingUsers = async (req: Request, res: Response) => {
  try {
    const pendingUsers = await authService.getPendingUsers();
    res.json(pendingUsers);
  } catch (error) {
    console.error('Error getting pending users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await authService.updateUserStatus(parseInt(userId), 'approved');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const denyUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await authService.updateUserStatus(parseInt(userId), 'denied');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error denying user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 