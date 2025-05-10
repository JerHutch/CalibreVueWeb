import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalibreService } from '../calibreService';
import sqlite3 from 'sqlite3';
import path from 'path';

// Mock sqlite3
vi.mock('sqlite3', () => {
  const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    close: vi.fn()
  };
  return {
    default: {
      Database: vi.fn(() => mockDb)
    },
    Database: vi.fn(() => mockDb)
  };
});

// Mock environment variables
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  }
}));

describe('CalibreService', () => {
  let calibreService: CalibreService;
  const mockDb = new sqlite3.Database(':memory:');

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    process.env.DB_FILENAME = 'test.db';
    calibreService = new CalibreService();
  });

  afterEach(() => {
    calibreService.close();
    vi.resetModules();
  });

  describe('getBooks', () => {
    it('should return paginated books with total count', async () => {
      const mockBooks = [
        { id: 1, title: 'Book 1', author: 'Author 1' },
        { id: 2, title: 'Book 2', author: 'Author 2' }
      ];

      // Mock the count query
      mockDb.get = vi.fn().mockImplementation((query, callback) => {
        callback(null, { count: 10 });
      });

      // Mock the books query
      mockDb.all = vi.fn().mockImplementation((query, params, callback) => {
        callback(null, mockBooks);
      });

      const result = await calibreService.getBooks(1, 2);

      expect(result).toEqual({
        books: mockBooks,
        total: 10
      });
      expect(mockDb.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM books',
        expect.any(Function)
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [2, 0],
        expect.any(Function)
      );
    });

    it('should handle database errors in getBooks', async () => {
      mockDb.get = vi.fn().mockImplementation((query, callback) => {
        callback(new Error('Database error'), null);
      });

      await expect(calibreService.getBooks()).rejects.toThrow('Database error');
    });
  });

  describe('getBookById', () => {
    it('should return a book by id', async () => {
      const mockBook = {
        id: 1,
        title: 'Test Book',
        author: 'Test Author'
      };

      mockDb.get = vi.fn().mockImplementation((query, params, callback) => {
        callback(null, mockBook);
      });

      const result = await calibreService.getBookById(1);

      expect(result).toEqual(mockBook);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1],
        expect.any(Function)
      );
    });

    it('should return null for non-existent book', async () => {
      mockDb.get = vi.fn().mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const result = await calibreService.getBookById(999);

      expect(result).toBeNull();
    });

    it('should handle database errors in getBookById', async () => {
      mockDb.get = vi.fn().mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      await expect(calibreService.getBookById(1)).rejects.toThrow('Database error');
    });
  });
}); 