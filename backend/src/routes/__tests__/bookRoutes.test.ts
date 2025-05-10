import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import bookRoutes from '../bookRoutes';
import { CalibreService } from '../../services/calibreService';
import { authenticateToken } from '../../middleware/authMiddleware';
import * as bookController from '../../controllers/bookController';

// Mock the auth middleware
vi.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: vi.fn((req, res, next) => next())
}));

// Mock the book controller
vi.mock('../../controllers/bookController', () => ({
  getBooks: vi.fn(),
  getBookById: vi.fn()
}));

describe('bookRoutes', () => {
  let app: express.Application;
  const mockToken = 'mock-token';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/books', bookRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/books', () => {
    it('should return books with default pagination', async () => {
      const mockBooks = [
        { id: 1, title: 'Book 1' },
        { id: 2, title: 'Book 2' }
      ];
      const mockTotal = 2;

      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.json({
          books: mockBooks,
          total: mockTotal
        });
      });

      const response = await request(app)
        .get('/api/books')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(bookController.getBooks).toHaveBeenCalled();
    });

    it('should handle custom pagination', async () => {
      const mockBooks = [{ id: 3, title: 'Book 3' }];
      const mockTotal = 1;

      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.json({
          books: mockBooks,
          total: mockTotal
        });
      });

      const response = await request(app)
        .get('/api/books?page=2&limit=1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(bookController.getBooks).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .get('/api/books')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /api/books/:id', () => {
    it('should return a book by id', async () => {
      const mockBook = { id: 1, title: 'Book 1' };

      (bookController.getBookById as any).mockImplementation((req: Request, res: Response) => {
        res.json(mockBook);
      });

      const response = await request(app)
        .get('/api/books/1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBook);
      expect(bookController.getBookById).toHaveBeenCalled();
    });

    it('should handle non-existent book', async () => {
      (bookController.getBookById as any).mockImplementation((req: Request, res: Response) => {
        res.status(404).json({ error: 'Book not found' });
      });

      const response = await request(app)
        .get('/api/books/999')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Book not found' });
    });

    it('should handle errors', async () => {
      (bookController.getBookById as any).mockImplementation((req: Request, res: Response) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .get('/api/books/1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });
}); 