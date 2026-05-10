import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { logout, getCurrentUser } from '../authController';
import { User } from '../../services/authService';
import logger from '../../utils/logger';

describe('Auth Controller', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      headers: {},
      isAuthenticated: vi.fn().mockReturnValue(false),
      user: undefined,
      logout: vi.fn((callback: (error?: Error) => void) => callback()),
      session: {
        destroy: vi.fn((callback: (error?: Error) => void) => callback())
      }
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    // Mock logger.error
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logout', () => {
    it('should log out and destroy the session before returning success message', async () => {
      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockRequest.logout).toHaveBeenCalled();
      expect(mockRequest.session.destroy).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });
    });

    it('should return an error if logout fails', async () => {
      mockRequest.logout = vi.fn((callback: (error?: Error) => void) => {
        callback(new Error('Logout failed'));
      });

      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockRequest.session.destroy).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Logout failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return an error if session destroy fails', async () => {
      mockRequest.session.destroy = vi.fn((callback: (error?: Error) => void) => {
        callback(new Error('Session destroy failed'));
      });

      await logout(mockRequest as Request, mockResponse as Response);

      expect(mockRequest.logout).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Logout failed'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should report unauthenticated if no session is available', async () => {
      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: false
      });
    });

    it('should report unauthenticated if isAuthenticated is missing', async () => {
      mockRequest.isAuthenticated = undefined;
      mockRequest.user = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        status: 'approved'
      };

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: false
      });
    });

    it('should report unauthenticated if the session has no user', async () => {
      mockRequest.isAuthenticated.mockReturnValue(true);

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: false
      });
    });

    it('should return pending session state for pending users', async () => {
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
        authenticated: false,
        user: pendingUser,
        status: 'pending'
      });
    });

    it('should return approved session state for approved users', async () => {
      const mockUser: User = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true,
        status: 'approved'
      };
      mockRequest.isAuthenticated.mockReturnValue(true);
      mockRequest.user = mockUser;

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: true,
        user: mockUser,
        status: 'approved'
      });
    });

    it('should return denied session state for denied users', async () => {
      const deniedUser: User = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        status: 'denied'
      };
      mockRequest.isAuthenticated.mockReturnValue(true);
      mockRequest.user = deniedUser;

      await getCurrentUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: false,
        user: deniedUser,
        status: 'denied'
      });
    });

    it('should handle internal server errors', async () => {
      mockRequest.isAuthenticated.mockImplementation(() => {
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
