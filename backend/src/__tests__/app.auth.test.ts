import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { AuthService, User } from '../services/authService';
import { CalibreService } from '../services/calibreService';

const approvedUser: User = {
  id: 1,
  username: 'reader',
  email: 'reader@example.com',
  isAdmin: false,
  status: 'approved'
};

const approvedAdminUser: User = {
  id: 2,
  username: 'admin',
  email: 'admin@example.com',
  isAdmin: true,
  status: 'approved'
};

const pendingUser: User = {
  id: 3,
  username: 'pending',
  email: 'pending@example.com',
  isAdmin: false,
  status: 'pending'
};

const deniedUser: User = {
  id: 4,
  username: 'denied',
  email: 'denied@example.com',
  isAdmin: false,
  status: 'denied'
};

const createCalibreService = () => ({
  getBooks: vi.fn().mockResolvedValue({ books: [], total: 0 }),
  getBookById: vi.fn(),
  getCoverPath: vi.fn(),
  getBookFilePath: vi.fn(),
  close: vi.fn()
}) as unknown as CalibreService;

const createAuthService = () => ({
  getPendingUsers: vi.fn().mockResolvedValue([]),
  updateUserStatus: vi.fn(),
  getUserById: vi.fn(),
  findOrCreateUser: vi.fn()
}) as unknown as AuthService;

const createTestApp = (testAuthUser?: User) => {
  const calibreService = createCalibreService();
  const authService = createAuthService();

  return {
    app: createApp(
      { calibreService, authService },
      {
        enableGoogleAuth: false,
        ...(testAuthUser ? { testAuthUser } : {})
      }
    ),
    calibreService,
    authService
  };
};

describe('app auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for anonymous books requests', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/books');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 for anonymous admin requests', async () => {
    const { app } = createTestApp();

    const response = await request(app).get('/api/admin/pending-users');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 403 for approved non-admin users on admin routes', async () => {
    const { app } = createTestApp(approvedUser);

    const response = await request(app).get('/api/admin/pending-users');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Admin access required' });
  });

  it('returns 200 for approved admin users on admin routes', async () => {
    const { app, authService } = createTestApp(approvedAdminUser);

    const response = await request(app).get('/api/admin/pending-users');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(authService.getPendingUsers).toHaveBeenCalledOnce();
  });

  it('returns 403 for pending sessions on protected book routes', async () => {
    const { app } = createTestApp(pendingUser);

    const response = await request(app).get('/api/books');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Account is not approved',
      status: 'pending'
    });
  });

  it('returns 403 for denied sessions on protected book routes', async () => {
    const { app } = createTestApp(deniedUser);

    const response = await request(app).get('/api/books');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Account is not approved',
      status: 'denied'
    });
  });
});
