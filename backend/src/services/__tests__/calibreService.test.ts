import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalibreService } from '../calibreService';
import path from 'path';

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

describe('CalibreService', () => {
  let calibreService: CalibreService;
  let mockDb: any;
  let mockPreparedStatement: any;

  beforeEach(() => {
    mockPreparedStatement = {
      get: vi.fn(),
      all: vi.fn()
    };
    mockDb = {
      prepare: vi.fn().mockReturnValue(mockPreparedStatement),
      close: vi.fn()
    };
    calibreService = new CalibreService(mockDb, '/path/to/metadata.db');

    // Mock the database queries
    mockPreparedStatement.get.mockImplementation((query: string) => {
      if (query.includes('COUNT')) {
        return { count: 2 };
      }
      return null;
    });
    mockPreparedStatement.all.mockImplementation((query: string) => {
      if (query.includes('SELECT')) {
        return [
          { id: 1, title: 'Book 1' },
          { id: 2, title: 'Book 2' }
        ];
      }
      return [];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getBooks', () => {
    it('should return paginated books with total count', async () => {
      const mockBooks = [
        { id: 1, title: 'Book 1' },
        { id: 2, title: 'Book 2' }
      ];
      const mockTotal = 2;

      // Mock the count query
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10);

      expect(result).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
    });

    it('should handle database errors in getBooks', async () => {
      // Mock the count query to throw an error
      mockPreparedStatement.get.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      try {
        await calibreService.getBooks(1, 10);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }

    });
  });

  describe('getBookById', () => {
    it('should return a book by id', async () => {
      const mockBook = { id: 1, title: 'Book 1' };
      mockPreparedStatement.get.mockReturnValueOnce(mockBook);

      const result = await calibreService.getBookById(1);

      expect(result).toEqual(mockBook);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent book', async () => {
      mockPreparedStatement.get.mockReturnValueOnce(null);

      const result = await calibreService.getBookById(999);

      expect(result).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors in getBookById', async () => {
      mockPreparedStatement.get.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      try {
        await calibreService.getBookById(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }

    });
  });

  describe('getCoverPath', () => {
    it('should return null for book without cover', () => {
      const book = {
        id: 1,
        title: 'Test Book',
        has_cover: 0,
        path: 'test/path'
      } as any;

      const result = calibreService.getCoverPath(book);
      expect(result).toBeNull();
    });

    it('should return correct cover path for book with cover', () => {
      const book = {
        id: 1,
        title: 'Test Book',
        has_cover: 1,
        path: 'test/path'
      } as any;

      const result = calibreService.getCoverPath(book);
      const expectedPath = path.join('/path/to', 'test/path', 'cover.jpg');
      expect(result).toBe(expectedPath);
    });
  });

  describe('getBookFilePath', () => {
    it('should return null for book without format', () => {
      const book = {
        id: 1,
        title: 'Test Book',
        path: 'test/path',
        format: null
      } as any;

      const result = calibreService.getBookFilePath(book);
      expect(result).toBeNull();
    });

    it('should return correct file path for book with format', () => {
      const book = {
        id: 1,
        title: 'Test Book',
        path: 'test/path',
        format: 'epub'
      } as any;

      const result = calibreService.getBookFilePath(book);
      const expectedPath = path.join('/path/to', 'test/path', 'Test Book.epub');
      expect(result).toBe(expectedPath);
    });
  });
}); 