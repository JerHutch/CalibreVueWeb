import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Database } from 'sqlite3';
import { AuthService } from '../authService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: Database;

  beforeEach(() => {
    mockDb = {
      get: vi.fn()
    } as unknown as Database;

    authService = new AuthService(mockDb);
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return null if user is not found', async () => {
      (mockDb.get as any).mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const result = await authService.validateUser('nonexistent', 'password');
      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      (mockDb.get as any).mockImplementation((query, params, callback) => {
        callback(null, {
          id: '123',
          username: 'testuser',
          email: 'test@example.com',
          password: hashedPassword,
          is_admin: 0
        });
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await authService.validateUser('testuser', 'wrong-password');
      expect(result).toBeNull();
    });

    it('should return user object if credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      (mockDb.get as any).mockImplementation((query, params, callback) => {
        callback(null, {
          id: '123',
          username: 'testuser',
          email: 'test@example.com',
          password: hashedPassword,
          is_admin: 1
        });
      });
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await authService.validateUser('testuser', 'correct-password');
      expect(result).toEqual({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      });
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      };

      (jwt.sign as any).mockReturnValue('mock-token');

      const token = authService.generateToken(user);
      expect(token).toBe('mock-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin
        },
        expect.any(String),
        { expiresIn: '24h' }
      );
    });
  });

  describe('getUserById', () => {
    it('should return null if user is not found', async () => {
      (mockDb.get as any).mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const result = await authService.getUserById('nonexistent');
      expect(result).toBeNull();
    });

    it('should return user object if found', async () => {
      (mockDb.get as any).mockImplementation((query, params, callback) => {
        callback(null, {
          id: '123',
          username: 'testuser',
          email: 'test@example.com',
          is_admin: 1
        });
      });

      const result = await authService.getUserById('123');
      expect(result).toEqual({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: true
      });
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token if valid', () => {
      const mockDecoded = { id: '123', username: 'testuser' };
      (jwt.verify as any).mockReturnValue(mockDecoded);

      const result = authService.verifyToken('valid-token');
      expect(result).toEqual(mockDecoded);
    });

    it('should return null if token is invalid', () => {
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = authService.verifyToken('invalid-token');
      expect(result).toBeNull();
    });
  });
}); 