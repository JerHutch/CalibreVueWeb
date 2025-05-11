import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken, initializeMiddleware } from '../authMiddleware';
import { AuthService } from '../../services/authService';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockAuthService: AuthService;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    nextFunction = vi.fn();
    mockAuthService = {
      verifyToken: vi.fn(),
      getUserById: vi.fn()
    } as unknown as AuthService;

    // Mock console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});

    initializeMiddleware(mockAuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 401 if no token is provided', async () => {
    await authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token'
    };
    (mockAuthService.verifyToken as any).mockReturnValue(null);

    await authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 404 if user is not found', async () => {
    mockRequest.headers = {
      authorization: 'Bearer valid-token'
    };
    (mockAuthService.verifyToken as any).mockReturnValue({ id: '123' });
    (mockAuthService.getUserById as any).mockResolvedValue(null);

    await authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should call next() if authentication is successful', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      isAdmin: false
    };

    mockRequest.headers = {
      authorization: 'Bearer valid-token'
    };
    (mockAuthService.verifyToken as any).mockReturnValue({ id: '123' });
    (mockAuthService.getUserById as any).mockResolvedValue(mockUser);

    await authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(nextFunction).toHaveBeenCalled();
    expect(mockRequest.user).toEqual(mockUser);
  });

  it('should handle internal server errors', async () => {
    mockRequest.headers = {
      authorization: 'Bearer valid-token'
    };
    (mockAuthService.verifyToken as any).mockImplementation(() => {
      throw new Error('Internal error');
    });

    await authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      nextFunction
    );

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(nextFunction).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
}); 