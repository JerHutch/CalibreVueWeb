import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { login, logout, getCurrentUser, initializeController } from '../authController';
import { AuthService } from '../../services/authService';

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthService: AuthService;

  beforeEach(() => {
    mockRequest = {
      body: {},
      headers: {}
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
    } as unknown as AuthService;

    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});

    initializeController(mockAuthService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should return 400 if username or password is missing', async () => {
      await login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Username and password are required'
      });
    });

    it('should return 401 if credentials are invalid', async () => {
      mockRequest.body = {
        username: 'testuser',
        password: 'wrong-password'
      };
      (mockAuthService.validateUser as any).mockResolvedValue(null);

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid username or password'
      });
    });

    it('should return user and token if credentials are valid', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      };
      mockRequest.body = {
        username: 'testuser',
        password: 'correct-password'
      };
      (mockAuthService.validateUser as any).mockResolvedValue(mockUser);
      (mockAuthService.generateToken as any).mockReturnValue('mock-token');

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockUser,
        token: 'mock-token'
      });
    });

    it('should handle internal server errors', async () => {
      mockRequest.body = {
        username: 'testuser',
        password: 'password'
      };
      (mockAuthService.validateUser as any).mockRejectedValue(new Error('Database error'));

      await login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(console.error).toHaveBeenCalled();
    });
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
      (mockAuthService.verifyToken as any).mockReturnValue({ id: '123' });
      (mockAuthService.getUserById as any).mockResolvedValue(null);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });

    it('should return user data if token is valid', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      };
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };
      (mockAuthService.verifyToken as any).mockReturnValue({ id: '123' });
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
      expect(console.error).toHaveBeenCalled();
    });
  });
}); 