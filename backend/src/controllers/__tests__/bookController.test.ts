import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { getBooks, getBookById, initializeController, getBookCover, downloadBook } from '../bookController';
import { CalibreService } from '../../services/calibreService';
import fs from 'fs';

// Mock the CalibreService
vi.mock('../../services/calibreService', () => ({
  CalibreService: vi.fn().mockImplementation(() => ({
    getBooks: vi.fn(),
    getBookById: vi.fn(),
    getCoverPath: vi.fn(),
    getBookFilePath: vi.fn(),
    close: vi.fn()
  }))
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  default: {
    existsSync: vi.fn()
  }
}));

describe('bookController', () => {
  let mockService: CalibreService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create mock request and response objects
    mockRequest = {
      query: {},
      params: {}
    };
    
    mockResponse = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      sendFile: vi.fn(),
      setHeader: vi.fn()
    };

    // Create mock service with all required methods
    mockService = {
      getBooks: vi.fn(),
      getBookById: vi.fn(),
      getCoverPath: vi.fn(),
      getBookFilePath: vi.fn(),
      close: vi.fn()
    } as unknown as CalibreService;

    initializeController(mockService);
  });

  describe('getBooks', () => {
    it('should return books with default pagination', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Book 1' }],
        total: 1
      };

      (mockService.getBooks as any).mockResolvedValue(mockBooks);

      await getBooks(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBooks).toHaveBeenCalledWith(1, 20, undefined);
      expect(mockResponse.json).toHaveBeenCalledWith(mockBooks);
    });

    it('should handle custom pagination', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Book 1' }],
        total: 1
      };

      mockRequest.query = { page: '2', limit: '10' };
      (mockService.getBooks as any).mockResolvedValue(mockBooks);

      await getBooks(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBooks).toHaveBeenCalledWith(2, 10, undefined);
      expect(mockResponse.json).toHaveBeenCalledWith(mockBooks);
    });

    it('should handle search parameter', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Harry Potter' }],
        total: 1
      };

      mockRequest.query = { search: 'Harry' };
      (mockService.getBooks as any).mockResolvedValue(mockBooks);

      await getBooks(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBooks).toHaveBeenCalledWith(1, 20, 'Harry');
      expect(mockResponse.json).toHaveBeenCalledWith(mockBooks);
    });

    it('should handle search with pagination', async () => {
      const mockBooks = {
        books: [{ id: 1, title: 'Harry Potter' }],
        total: 1
      };

      mockRequest.query = { page: '2', limit: '10', search: 'Harry' };
      (mockService.getBooks as any).mockResolvedValue(mockBooks);

      await getBooks(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBooks).toHaveBeenCalledWith(2, 10, 'Harry');
      expect(mockResponse.json).toHaveBeenCalledWith(mockBooks);
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (mockService.getBooks as any).mockRejectedValue(error);

      await getBooks(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('getBookById', () => {
    it('should return a book by id', async () => {
      const mockBook = { id: 1, title: 'Book 1' };
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockResolvedValue(mockBook);

      await getBookById(mockRequest as Request, mockResponse as Response);

      expect(mockService.getBookById).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith(mockBook);
    });

    it('should handle non-existent book', async () => {
      mockRequest.params = { id: '999' };
      (mockService.getBookById as any).mockResolvedValue(null);

      await getBookById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Book not found' });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockRejectedValue(error);

      await getBookById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('getBookCover', () => {
    it('should return 400 for invalid book ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await getBookCover(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid book ID' });
    });

    it('should return 404 for non-existent book', async () => {
      mockRequest.params = { id: '999' };
      (mockService.getBookById as any).mockResolvedValue(null);
      await getBookCover(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Book not found' });
    });

    it('should return 404 for book without cover', async () => {
      const mockBook = {
        id: 1,
        title: 'Test Book',
        has_cover: 0
      };
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockResolvedValue(mockBook);
      (mockService.getCoverPath as any).mockReturnValue(null);
      await getBookCover(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Cover not found' });
    });

    it('should serve cover file when available', async () => {
      const mockBook = {
        id: 1,
        title: 'Test Book',
        has_cover: 1
      };
      const mockCoverPath = '/path/to/cover.jpg';
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockResolvedValue(mockBook);
      (mockService.getCoverPath as any).mockReturnValue(mockCoverPath);
      (fs.existsSync as any).mockReturnValue(true);
      (mockResponse.sendFile as any) = vi.fn();

      await getBookCover(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.sendFile).toHaveBeenCalledWith(mockCoverPath);
    });
  });

  describe('downloadBook', () => {
    it('should return 400 for invalid book ID', async () => {
      mockRequest.params = { id: 'invalid' };
      await downloadBook(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid book ID' });
    });

    it('should return 404 for non-existent book', async () => {
      mockRequest.params = { id: '999' };
      (mockService.getBookById as any).mockResolvedValue(null);
      await downloadBook(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Book not found' });
    });

    it('should return 404 for book without format', async () => {
      const mockBook = {
        id: 1,
        title: 'Test Book',
        format: null
      };
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockResolvedValue(mockBook);
      (mockService.getBookFilePath as any).mockReturnValue(null);
      await downloadBook(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Book file not found' });
    });

    it('should serve book file when available', async () => {
      const mockBook = {
        id: 1,
        title: 'Test Book',
        format: 'epub'
      };
      const mockFilePath = '/path/to/book.epub';
      mockRequest.params = { id: '1' };
      (mockService.getBookById as any).mockResolvedValue(mockBook);
      (mockService.getBookFilePath as any).mockReturnValue(mockFilePath);
      (fs.existsSync as any).mockReturnValue(true);
      (mockResponse.sendFile as any) = vi.fn();

      await downloadBook(mockRequest as Request, mockResponse as Response);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="Test Book.epub"');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/epub');
      expect(mockResponse.sendFile).toHaveBeenCalledWith(mockFilePath);
    });
  });
}); 