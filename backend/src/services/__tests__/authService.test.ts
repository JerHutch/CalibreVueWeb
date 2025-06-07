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

}); 