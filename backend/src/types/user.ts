export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInput {
  name: string;
  email: string;
  isAdmin?: boolean;
  isApproved?: boolean;
} 