import { UserStatus } from '../services/authService';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      isAdmin: boolean;
      googleId?: string;
      displayName?: string;
      picture?: string;
      status: UserStatus;
    }
  }
}

export {};
