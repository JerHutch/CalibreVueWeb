import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { getBooks, getBookById, initializeController } from '../bookController';
import { CalibreService } from '../../services/calibreService';

// Mock the CalibreService
vi.mock('../../services/calibreService', () => ({
  CalibreService: vi.fn().mockImplementation(() => ({
    getBooks: vi.fn(),
    getBookById: vi.fn(),
    close: vi.fn()
  }))
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
      status: vi.fn().mockReturnThis()
    };

    // Get the mocked service instance and initialize controller
    mockService = new CalibreService();
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

      expect(mockService.getBooks).toHaveBeenCalledWith(1, 20);
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

      expect(mockService.getBooks).toHaveBeenCalledWith(2, 10);
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
}); 