import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { AuthService, User } from '../services/authService';
import { CalibreService } from '../services/calibreService';

const approvedUser: User = {
  id: 10,
  username: 'reader',
  email: 'reader@example.com',
  isAdmin: false,
  status: 'approved'
};

const createCalibreService = () => ({
  getBooks: vi.fn().mockResolvedValue({
    books: [{ id: 1, title: 'The Test Book' }],
    total: 1
  }),
  getBookById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) {
      return { id: 1, title: 'The Test Book' };
    }

    return null;
  }),
  getCoverPath: vi.fn(),
  getBookFilePath: vi.fn(),
  close: vi.fn()
}) as unknown as CalibreService;

const createAuthService = () => ({
  getPendingUsers: vi.fn(),
  updateUserStatus: vi.fn(),
  getUserById: vi.fn(),
  findOrCreateUser: vi.fn()
}) as unknown as AuthService;

const createTestApp = () => {
  const calibreService = createCalibreService();
  const authService = createAuthService();

  return {
    app: createApp(
      { calibreService, authService },
      { enableGoogleAuth: false, testAuthUser: approvedUser }
    ),
    calibreService
  };
};

describe('app book routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows approved sessions to list books', async () => {
    const { app, calibreService } = createTestApp();

    const response = await request(app).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      books: [{ id: 1, title: 'The Test Book' }],
      total: 1
    });
    expect(calibreService.getBooks).toHaveBeenCalledWith(1, 20, undefined);
  });

  it('returns 400 for invalid book ids', async () => {
    const { app, calibreService } = createTestApp();

    const response = await request(app).get('/api/books/not-a-number');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid book ID' });
    expect(calibreService.getBookById).not.toHaveBeenCalled();
  });

  it('returns 404 for missing book ids', async () => {
    const { app, calibreService } = createTestApp();

    const response = await request(app).get('/api/books/999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Book not found' });
    expect(calibreService.getBookById).toHaveBeenCalledWith(999);
  });
});
