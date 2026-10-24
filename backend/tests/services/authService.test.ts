import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../../src/services/authService';
import logger from '../../src/utils/logger';

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
    it('does not log each lookup', async () => {
      const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
      mockPreparedStatement.get.mockReturnValueOnce(null);
      await authService.getUserById('7');
      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });

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
        google_id: 'google-123',
        display_name: 'Test User',
        picture: 'https://example.com/avatar.png',
        is_admin: 1,
        status: 'approved'
      };
      mockPreparedStatement.get.mockReturnValueOnce(mockUser);

      const result = await authService.getUserById('1');
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        isAdmin: true,
        googleId: mockUser.google_id,
        displayName: mockUser.display_name,
        picture: mockUser.picture,
        status: mockUser.status
      });
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('findOrCreateUser', () => {
    it('explicitly sets timestamps when creating a user', async () => {
      const googleLookupStmt = { get: vi.fn().mockReturnValueOnce(undefined) };
      const emailLookupStmt = { get: vi.fn().mockReturnValueOnce(undefined) };
      const insertStmt = { run: vi.fn().mockReturnValueOnce({ lastInsertRowid: 1 }) };
      const newUserStmt = {
        get: vi.fn().mockReturnValueOnce({
          id: 1,
          username: 'test',
          email: 'test@example.com',
          google_id: 'google-123',
          display_name: 'Test User',
          picture: 'https://example.com/avatar.png',
          is_admin: 0,
          status: 'pending'
        })
      };
      mockDb.prepare
        .mockReturnValueOnce(googleLookupStmt)
        .mockReturnValueOnce(emailLookupStmt)
        .mockReturnValueOnce(insertStmt)
        .mockReturnValueOnce(newUserStmt);

      await authService.findOrCreateUser({
        id: 'google-123',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        photos: [{ value: 'https://example.com/avatar.png' }]
      });

      const insertSql = mockDb.prepare.mock.calls[2][0];
      expect(insertSql).toContain('created_at');
      expect(insertSql).toContain('updated_at');
      expect(insertSql).toContain('CURRENT_TIMESTAMP');
    });

    it('updates timestamps when linking Google info to an existing user', async () => {
      const existingUser = {
        id: 1,
        username: 'test',
        email: 'test@example.com',
        google_id: null,
        display_name: null,
        picture: null,
        is_admin: 0,
        status: 'pending'
      };
      const googleLookupStmt = { get: vi.fn().mockReturnValueOnce(undefined) };
      const emailLookupStmt = { get: vi.fn().mockReturnValueOnce(existingUser) };
      const updateStmt = { run: vi.fn() };
      const updatedUserStmt = {
        get: vi.fn().mockReturnValueOnce({
          ...existingUser,
          google_id: 'google-123',
          display_name: 'Test User',
          picture: 'https://example.com/avatar.png'
        })
      };
      mockDb.prepare
        .mockReturnValueOnce(googleLookupStmt)
        .mockReturnValueOnce(emailLookupStmt)
        .mockReturnValueOnce(updateStmt)
        .mockReturnValueOnce(updatedUserStmt);

      await authService.findOrCreateUser({
        id: 'google-123',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        photos: [{ value: 'https://example.com/avatar.png' }]
      });

      const updateSql = mockDb.prepare.mock.calls[2][0];
      expect(updateSql).toContain('created_at = COALESCE(created_at, CURRENT_TIMESTAMP)');
      expect(updateSql).toContain('updated_at = CURRENT_TIMESTAMP');
    });
  });

  describe('findOrCreateUser admin bootstrap', () => {
    const pendingRow = {
      id: 1, username: 'me', email: 'Me@Example.com', google_id: 'g1',
      display_name: 'Me', picture: null, is_admin: 0, status: 'pending'
    };
    const promotedRow = { ...pendingRow, is_admin: 1, status: 'approved' };

    function setup() {
      const updateStmt = { run: vi.fn() };
      mockDb.prepare
        .mockReturnValueOnce({ get: vi.fn().mockReturnValueOnce(pendingRow) })
        .mockReturnValueOnce(updateStmt)
        .mockReturnValueOnce({ get: vi.fn().mockReturnValueOnce(promotedRow) });
      return updateStmt;
    }
    const profile = (verified: unknown, email = 'me@example.com') => ({
      id: 'g1', displayName: 'Me', emails: [{ value: email, verified }]
    });

    afterEach(() => { delete process.env.ADMIN_EMAILS; });

    it('promotes a listed verified email (case-insensitive)', async () => {
      process.env.ADMIN_EMAILS = ' other@x.com, ME@example.com ';
      const updateStmt = setup();
      const user = await authService.findOrCreateUser(profile(true));
      expect(updateStmt.run).toHaveBeenCalledWith(1);
      expect(user).toMatchObject({ isAdmin: true, status: 'approved' });
    });

    it('does not promote an unlisted email', async () => {
      process.env.ADMIN_EMAILS = 'other@x.com';
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn().mockReturnValueOnce(pendingRow) });
      const user = await authService.findOrCreateUser(profile(true));
      expect(user).toMatchObject({ isAdmin: false, status: 'pending' });
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('does not promote an unverified email', async () => {
      process.env.ADMIN_EMAILS = 'me@example.com';
      mockDb.prepare.mockReturnValueOnce({ get: vi.fn().mockReturnValueOnce(pendingRow) });
      const user = await authService.findOrCreateUser(profile(false));
      expect(user).toMatchObject({ isAdmin: false, status: 'pending' });
    });
  });

  describe('updateUserStatus', () => {
    it('updates timestamps when changing user status', async () => {
      const updateStmt = { run: vi.fn() };
      const selectStmt = {
        get: vi.fn().mockReturnValueOnce({
          id: 1,
          username: 'test',
          email: 'test@example.com',
          google_id: 'google-123',
          display_name: 'Test User',
          picture: 'https://example.com/avatar.png',
          is_admin: 0,
          status: 'approved'
        })
      };
      mockDb.prepare
        .mockReturnValueOnce(updateStmt)
        .mockReturnValueOnce(selectStmt);

      await authService.updateUserStatus(1, 'approved');

      const updateSql = mockDb.prepare.mock.calls[0][0];
      expect(updateSql).toContain('created_at = COALESCE(created_at, CURRENT_TIMESTAMP)');
      expect(updateSql).toContain('updated_at = CURRENT_TIMESTAMP');
      expect(updateStmt.run).toHaveBeenCalledWith('approved', 1);
    });
  });
});
