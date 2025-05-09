import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import bookRoutes from '../bookRoutes';
import * as bookController from '../../controllers/bookController';

// Mock the book controller
vi.mock('../../controllers/bookController', () => ({
  getBooks: vi.fn(),
  getBookById: vi.fn()
}));

describe('bookRoutes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create a new Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/books', bookRoutes);
  });

  describe('GET /api/books', () => {
    it('should return books with default pagination', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Book 1' }],
        total: 1
      };

      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.json(mockBooks);
      });

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body).toEqual(mockBooks);
      expect(bookController.getBooks).toHaveBeenCalled();
    });

    it('should handle custom pagination', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Book 1' }],
        total: 1
      };

      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.json(mockBooks);
      });

      const response = await request(app)
        .get('/api/books?page=2&limit=10')
        .expect(200);

      expect(response.body).toEqual(mockBooks);
      expect(bookController.getBooks).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      (bookController.getBooks as any).mockImplementation((req: Request, res: Response) => {
        res.status(500).json({ error: 'Database error' });
      });

      const response = await request(app)
        .get('/api/books')
        .expect(500);

      expect(response.body).toEqual({ error: 'Database error' });
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
        .expect(200);

      expect(response.body).toEqual(mockBook);
      expect(bookController.getBookById).toHaveBeenCalled();
    });

    it('should handle non-existent book', async () => {
      (bookController.getBookById as any).mockImplementation((req: Request, res: Response) => {
        res.status(404).json({ error: 'Book not found' });
      });

      const response = await request(app)
        .get('/api/books/999')
        .expect(404);

      expect(response.body).toEqual({ error: 'Book not found' });
    });

    it('should handle errors', async () => {
      (bookController.getBookById as any).mockImplementation((req: Request, res: Response) => {
        res.status(500).json({ error: 'Database error' });
      });

      const response = await request(app)
        .get('/api/books/1')
        .expect(500);

      expect(response.body).toEqual({ error: 'Database error' });
    });
  });
}); 