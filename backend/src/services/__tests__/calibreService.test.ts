import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalibreService } from '../calibreService';

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
    calibreService = new CalibreService(mockDb);
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
      expect(mockDb.close).toHaveBeenCalled();
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

      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe('getBookById', () => {
    it('should return a book by id', async () => {
      const mockBook = { id: 1, title: 'Book 1' };
      mockPreparedStatement.get.mockReturnValueOnce(mockBook);

      const result = await calibreService.getBookById(1);

      expect(result).toEqual(mockBook);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should return null for non-existent book', async () => {
      mockPreparedStatement.get.mockReturnValueOnce(null);

      const result = await calibreService.getBookById(999);

      expect(result).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.close).toHaveBeenCalled();
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

      expect(mockDb.close).toHaveBeenCalled();
    });
  });
}); 