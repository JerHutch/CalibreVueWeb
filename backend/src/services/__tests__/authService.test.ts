import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../authService';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  compare: vi.fn()
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    prepare: vi.fn(),
    close: vi.fn()
  };
  return {
    default: vi.fn().mockImplementation(() => mockDb)
  };
});

// Mock environment variables
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  }
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: any;
  let mockPreparedStatement: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock prepared statement
    mockPreparedStatement = {
      get: vi.fn(),
      all: vi.fn()
    };

    // Create mock database
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPreparedStatement),
      close: vi.fn()
    };

    // Create auth service with mock database
    authService = new AuthService(mockDb);
  });

  describe('validateUser', () => {
    it('should return null if user is not found', async () => {
      mockPreparedStatement.get.mockReturnValueOnce(null);

      const result = await authService.validateUser('nonexistent', 'password');
      expect(result).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should return null if password is invalid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password',
        is_admin: 1
      };
      mockPreparedStatement.get.mockReturnValueOnce(mockUser);

      const result = await authService.validateUser('testuser', 'wrong_password');
      expect(result).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should return user object if credentials are valid', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password: 'correct_password',
        is_admin: 1
      };
      mockPreparedStatement.get.mockReturnValueOnce(mockUser);

      const result = await authService.validateUser('testuser', 'correct_password');
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        isAdmin: true
      });
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      };
      const token = authService.generateToken(user);
      
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      expect(decoded).toMatchObject({
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      });
    });
  });

  describe('getUserById', () => {
    it('should return null if user is not found', async () => {
      mockPreparedStatement.get.mockReturnValueOnce(null);

      const result = await authService.getUserById('999');
      expect(result).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should return user object if found', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        is_admin: 1
      };
      mockPreparedStatement.get.mockReturnValueOnce(mockUser);

      const result = await authService.getUserById('1');
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        isAdmin: true
      });
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token if valid', () => {
      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      };
      const token = authService.generateToken(user);
      
      const result = authService.verifyToken(token);
      expect(result).toMatchObject({
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      });
    });

    it('should return null if token is invalid', () => {
      const result = authService.verifyToken('invalid-token');
      expect(result).toBeNull();
    });
  });
}); 