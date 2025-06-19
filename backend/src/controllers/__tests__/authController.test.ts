import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { logout, getCurrentUser, initializeController } from '../authController';
import { AuthService, User } from '../../services/authService';
import logger from '../../utils/logger';

// Define the mock service interface
interface MockAuthService {
  validateUser: (username: string, password: string) => Promise<User | null>;
  generateToken: (user: User) => string;
  verifyToken: (token: string) => any;
  getUserById: (id: string) => Promise<User | null>;
}

describe('Auth Controller', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;
  let mockAuthService: MockAuthService;

  beforeEach(() => {
    mockRequest = {
      body: {},
      headers: {},
      isAuthenticated: vi.fn().mockReturnValue(false),
      user: undefined
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockAuthService = {
      validateUser: vi.fn(),
      generateToken: vi.fn(),
      verifyToken: vi.fn(),
      getUserById: vi.fn()
    };

    // Mock logger.error
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    initializeController(mockAuthService as unknown as AuthService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logout', () => {
    it('should return success message', async () => {
      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return 401 if no token is provided', async () => {
      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No token provided'
      });
    });

    it('should return 401 if token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };
      (mockAuthService.verifyToken as any).mockReturnValue(null);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token'
      });
    });

    it('should return 404 if user is not found', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      (mockAuthService.verifyToken as any).mockReturnValue({ id: 123 });
      (mockAuthService.getUserById as any).mockResolvedValue(null);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });

    it('should return pending status for pending users via session', async () => {
      const pendingUser: User = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        status: 'pending'
      };
      mockRequest.isAuthenticated.mockReturnValue(true);
      mockRequest.user = pendingUser;

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'pending',
        message: 'Your account is pending approval by an administrator.',
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          status: pendingUser.status
        }
      });
    });

    it('should return pending status for pending users via token', async () => {
      const pendingUser: User = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        status: 'pending'
      };
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      (mockAuthService.verifyToken as any).mockReturnValue({ id: 123 });
      (mockAuthService.getUserById as any).mockResolvedValue(pendingUser);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'pending',
        message: 'Your account is pending approval by an administrator.',
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          status: pendingUser.status
        }
      });
    });

    it('should return user data if token is valid and user is approved', async () => {
      const mockUser: User = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true,
        status: 'approved'
      };
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      (mockAuthService.verifyToken as any).mockReturnValue({ id: 123 });
      (mockAuthService.getUserById as any).mockResolvedValue(mockUser);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it('should handle internal server errors', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      (mockAuthService.verifyToken as any).mockImplementation(() => {
        throw new Error('Internal error');
      });

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
