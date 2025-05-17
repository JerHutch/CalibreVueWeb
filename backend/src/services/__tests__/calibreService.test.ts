import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalibreService, Book } from '../calibreService';
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

    it('should handle search by title', async () => {
      const mockBooks = [
        { id: 1, title: 'Harry Potter' }
      ];
      const mockTotal = 1;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10, 'Harry');

      expect(result).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
      // Verify the search pattern was used
      const searchPattern = '%Harry%';
      expect(mockPreparedStatement.get).toHaveBeenCalledWith(searchPattern, searchPattern);
      expect(mockPreparedStatement.all).toHaveBeenCalledWith(searchPattern, searchPattern, 10, 0);
    });

    it('should handle search by author', async () => {
      const mockBooks = [
        { id: 1, title: 'Book 1', author: 'J.K. Rowling' }
      ];
      const mockTotal = 1;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10, 'Rowling');

      expect(result).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
      // Verify the search pattern was used
      const searchPattern = '%Rowling%';
      expect(mockPreparedStatement.get).toHaveBeenCalledWith(searchPattern, searchPattern);
      expect(mockPreparedStatement.all).toHaveBeenCalledWith(searchPattern, searchPattern, 10, 0);
    });

    it('should handle empty search results', async () => {
      const mockBooks: any[] = [];
      const mockTotal = 0;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10, 'Nonexistent');

      expect(result).toEqual({
        books: [],
        total: 0
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    });

    it('should handle search with special characters', async () => {
      const mockBooks = [
        { id: 1, title: 'C++ Programming', author: 'John O\'Connor' }
      ];
      const mockTotal = 1;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10, 'C++');

      expect(result).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
      // Verify the search pattern was used with escaped special characters
      const searchPattern = '%C++%';
      expect(mockPreparedStatement.get).toHaveBeenCalledWith(searchPattern, searchPattern);
      expect(mockPreparedStatement.all).toHaveBeenCalledWith(searchPattern, searchPattern, 10, 0);
    });

    it('should handle search with apostrophes and quotes', async () => {
      const mockBooks = [
        { id: 1, title: 'The "Great" Gatsby', author: 'F. Scott Fitzgerald' }
      ];
      const mockTotal = 1;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks);

      const result = await calibreService.getBooks(1, 10, 'Great');

      expect(result).toEqual({
        books: mockBooks,
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
      // Verify the search pattern was used with proper escaping
      const searchPattern = '%Great%';
      expect(mockPreparedStatement.get).toHaveBeenCalledWith(searchPattern, searchPattern);
      expect(mockPreparedStatement.all).toHaveBeenCalledWith(searchPattern, searchPattern, 10, 0);
    });

    it('should handle large result sets efficiently', async () => {
      const mockBooks = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Book ${i + 1}`,
        author: 'Test Author'
      }));
      const mockTotal = 1000;

      // Mock the count query with search
      mockPreparedStatement.get.mockReturnValueOnce({ count: mockTotal });

      // Mock the books query with search
      mockPreparedStatement.all.mockReturnValueOnce(mockBooks.slice(0, 20)); // Only return first page

      const startTime = Date.now();
      const result = await calibreService.getBooks(1, 20, 'Test');
      const endTime = Date.now();

      expect(result).toEqual({
        books: mockBooks.slice(0, 20),
        total: mockTotal
      });
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      
      // Verify the query execution time is reasonable (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle search errors gracefully', async () => {
      // Mock the count query to throw an error
      mockPreparedStatement.get.mockImplementationOnce(() => {
        throw new Error('Search query error');
      });

      await expect(calibreService.getBooks(1, 10, 'Test')).rejects.toThrow('Search query error');
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
        author: 'Test Author',
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
        author: 'Test Author',
        path: 'test/path',
        format: 'epub'
      } as any;

      const result = calibreService.getBookFilePath(book);
      const expectedPath = path.join('/path/to', 'test/path', 'Test Book - Test Author.epub');
      expect(result).toBe(expectedPath);
    });

    it('should handle multiple authors correctly', () => {
      const book = {
        id: 1,
        title: 'Test Book',
        author: 'Author One| Author Two| Author Three',
        path: 'test/path',
        format: 'epub'
      } as any;

      const result = calibreService.getBookFilePath(book);
      const expectedPath = path.join('/path/to', 'test/path', 'Test Book - Author One, Author Two, Author Three.epub');
      expect(result).toBe(expectedPath);
    });
  });
}); 