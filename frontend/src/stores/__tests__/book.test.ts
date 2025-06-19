import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBookStore } from '../bookStore';
import { faker } from '@faker-js/faker';

// Mock the api module
vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock the useFileDownload composable
vi.mock('../../composables/useFileDownload', () => ({
  useFileDownload: vi.fn(() => ({
    downloadFile: vi.fn(),
    isDownloading: { value: false },
    downloadError: { value: null },
    downloadProgress: { value: 0 }
  }))
}));

// Import the mocked api
import api from '../../api/axios';
import { useFileDownload } from '../../composables/useFileDownload';
const mockedApi = api as unknown as {
  get: Mock;
};
const mockedUseFileDownload = useFileDownload as unknown as {
  downloadFile: Mock;
};

// Helper function to generate a mock book
const generateMockBook = () => ({
  id: faker.number.int({ min: 1, max: 1000 }),
  title: faker.lorem.words(3),
  author: faker.person.fullName(),
  publisher: faker.company.name(),
  pubdate: faker.date.past().toISOString(),
  isbn: faker.string.numeric(13),
  path: faker.system.filePath(),
  has_cover: faker.number.int({ min: 0, max: 1 }),
  timestamp: faker.date.recent().toISOString(),
  last_modified: faker.date.recent().toISOString(),
  series_index: faker.number.int({ min: 1, max: 10 }),
  series: faker.lorem.words(2),
  language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
  format: faker.helpers.arrayElement(['epub', 'pdf', 'mobi'])
});

describe('Book Store', () => {
  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia());
    // Reset all mocks
    vi.clearAllMocks();
    // Set a seed for reproducible results
    faker.seed(123);
  });

  describe('fetchBooks', () => {
    it('should fetch books successfully', async () => {
      const mockBooks = {
        books: Array.from({ length: 5 }, generateMockBook),
        total: 5
      };

      mockedApi.get.mockResolvedValueOnce({ data: mockBooks });

      const store = useBookStore();
      await store.fetchBooks();

      expect(store.books).toEqual(mockBooks.books);
      expect(store.total).toBe(5);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.currentPage).toBe(1);
      expect(store.pageSize).toBe(20);
      expect(mockedApi.get).toHaveBeenCalledWith('/books', {
        params: { page: 1, limit: 20, search: '' }
      });
    });

    it('should handle custom pagination', async () => {
      const mockBooks = {
        books: Array.from({ length: 10 }, generateMockBook),
        total: 50
      };

      mockedApi.get.mockResolvedValueOnce({ data: mockBooks });

      const store = useBookStore();
      await store.fetchBooks(2, 10);

      expect(store.currentPage).toBe(2);
      expect(store.pageSize).toBe(10);
      expect(mockedApi.get).toHaveBeenCalledWith('/books', {
        params: { page: 2, limit: 10, search: '' }
      });
    });

    it('should handle errors', async () => {
      const errorMessage = faker.lorem.sentence();
      mockedApi.get.mockRejectedValueOnce(new Error(errorMessage));

      const store = useBookStore();
      await store.fetchBooks();

      expect(store.books).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBe(errorMessage);
    });
  });

  describe('totalPages', () => {
    it('should calculate total pages correctly', () => {
      const store = useBookStore();
      store.total = faker.number.int({ min: 100, max: 200 });
      store.pageSize = 20;

      expect(store.totalPages).toBe(Math.ceil(store.total / store.pageSize));
    });

    it('should handle zero total', () => {
      const store = useBookStore();
      store.total = 0;
      store.pageSize = 20;

      expect(store.totalPages).toBe(0);
    });

    it('should round up partial pages', () => {
      const store = useBookStore();
      store.total = faker.number.int({ min: 21, max: 39 });
      store.pageSize = 20;

      expect(store.totalPages).toBe(2);
    });
  });

  describe('getCoverUrl', () => {
    it('should return blob URL for book cover', async () => {
      const store = useBookStore();
      const bookId = 123;
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      const mockBlobUrl = 'blob:http://localhost:3000/test-url';
      
      // Mock URL.createObjectURL
      const originalCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl);
      
      mockedApi.get.mockResolvedValueOnce({ data: mockBlob });

      const url = await store.getCoverUrl(bookId);
      
      expect(mockedApi.get).toHaveBeenCalledWith(`/books/${bookId}/cover`, {
        responseType: 'blob'
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(url).toBe(mockBlobUrl);
      
      // Restore original function
      URL.createObjectURL = originalCreateObjectURL;
    });

    it('should return empty string on error', async () => {
      const store = useBookStore();
      const bookId = 123;
      
      mockedApi.get.mockRejectedValueOnce(new Error('Cover not found'));

      const url = await store.getCoverUrl(bookId);
      
      expect(url).toBe('');
    });
  });

}); 
