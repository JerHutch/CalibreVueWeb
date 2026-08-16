import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { AuthService, User } from '../../src/services/authService';
import { CalibreService } from '../../src/services/calibreService';

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

const originalFrontendUrl = process.env.FRONTEND_URL;
const originalNodeEnv = process.env.NODE_ENV;

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

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
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

  it('issues a session cookie for an HTTP frontend in production mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://localhost:8888';
    const { app } = createTestApp(approvedUser);

    const response = await request(app).get('/api/auth/me');
    const cookies = response.headers['set-cookie'] ?? [];

    expect(response.status).toBe(200);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).not.toContain('Secure');
  });

  it('uses secure session cookies for an HTTPS frontend behind a proxy', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://books.example.com';
    const { app } = createTestApp(approvedUser);

    const response = await request(app)
      .get('/api/auth/me')
      .set('X-Forwarded-Proto', 'https');
    const cookies = response.headers['set-cookie'] ?? [];

    expect(response.status).toBe(200);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain('Secure');
  });
});
