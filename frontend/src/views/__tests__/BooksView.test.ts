import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BooksView from '../BooksView.vue';
import { useBookStore } from '../../stores/book';
import { faker } from '@faker-js/faker';
import { createTestingPinia } from '@pinia/testing';
import { flushPromises } from '@vue/test-utils';

// Mock the book store
vi.mock('../../stores/book', () => ({
  useBookStore: vi.fn()
}));

describe('BooksView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    faker.seed(123);
  });

  it('renders loading state', () => {
    const mockStore = {
      books: [],
      loading: true,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 0,
      fetchBooks: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    expect(wrapper.text()).toContain('Loading books...');
    expect(mockStore.fetchBooks).toHaveBeenCalled();
  });

  it('renders error state', () => {
    const errorMessage = faker.lorem.sentence();
    const mockStore = {
      books: [],
      loading: false,
      error: errorMessage,
      currentPage: 1,
      pageSize: 20,
      totalPages: 0,
      fetchBooks: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    expect(wrapper.text()).toContain(errorMessage);
  });

  it('renders books grid', () => {
    const pubDate = faker.date.past();
    const mockBooks = [
      {
        id: 1,
        title: 'Test Book',
        author: 'Test Author',
        publisher: 'Test Publisher',
        pubdate: pubDate.toISOString(),
        isbn: '1234567890',
        path: '/path/to/book',
        has_cover: 1,
        timestamp: faker.date.recent().toISOString(),
        last_modified: faker.date.recent().toISOString(),
        series_index: 1,
        series: 'Test Series',
        language: 'en',
        format: 'epub'
      }
    ];

    const mockStore = {
      books: mockBooks,
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      getCoverUrl: vi.fn().mockReturnValue('/api/books/1/cover'),
      getDownloadUrl: vi.fn().mockReturnValue('/api/books/1/download')
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    expect(wrapper.find('.books-grid').exists()).toBe(true);
    expect(wrapper.find('.book-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test Book');
    expect(wrapper.text()).toContain('Test Author');
    expect(wrapper.text()).toContain('Test Series');
    
    // Check for cover image
    const coverImg = wrapper.find('.book-cover img');
    expect(coverImg.exists()).toBe(true);
    expect(coverImg.attributes('src')).toBe('/api/books/1/cover');
    expect(coverImg.attributes('alt')).toBe('Test Book');

    // Check for download button
    const downloadButton = wrapper.find('.download-button');
    expect(downloadButton.exists()).toBe(true);
    expect(downloadButton.attributes('href')).toBe('/api/books/1/download');
    expect(downloadButton.text()).toBe('Download EPUB');
    
    // Check for the year in the book meta section
    const bookMeta = wrapper.find('.book-meta');
    expect(bookMeta.exists()).toBe(true);
    expect(bookMeta.text()).toContain(pubDate.getFullYear().toString());
  });

  it('does not show cover for book without cover', () => {
    const mockBooks = [{
      id: 1,
      title: 'Test Book',
      author: 'Test Author',
      has_cover: 0,
      format: 'epub'
    }];

    const mockStore = {
      books: mockBooks,
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      getCoverUrl: vi.fn(),
      getDownloadUrl: vi.fn().mockReturnValue('/api/books/1/download')
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    expect(wrapper.find('.book-cover').exists()).toBe(false);
  });

  it('does not show download button for book without format', () => {
    const mockBooks = [{
      id: 1,
      title: 'Test Book',
      author: 'Test Author',
      has_cover: 1,
      format: null
    }];

    const mockStore = {
      books: mockBooks,
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      getCoverUrl: vi.fn().mockReturnValue('/api/books/1/cover'),
      getDownloadUrl: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    expect(wrapper.find('.download-button').exists()).toBe(false);
  });

  it('handles pagination', async () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 2,
      pageSize: 20,
      totalPages: 3,
      fetchBooks: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Test previous button
    await wrapper.find('.pagination button:first-child').trigger('click');
    expect(mockStore.fetchBooks).toHaveBeenCalledWith(1, 20);

    // Test next button
    await wrapper.find('.pagination button:last-child').trigger('click');
    expect(mockStore.fetchBooks).toHaveBeenCalledWith(3, 20);
  });

  it('disables pagination buttons appropriately', () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    const prevButton = wrapper.find('.pagination button:first-child');
    const nextButton = wrapper.find('.pagination button:last-child');

    expect(prevButton.attributes('disabled')).toBeDefined();
    expect(nextButton.attributes('disabled')).toBeDefined();
  });

  it('handles search input', async () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Find the search input
    const searchInput = wrapper.find('.search-input');
    expect(searchInput.exists()).toBe(true);
    
    // Type in the search input
    await searchInput.setValue('Harry Potter');
    
    // Verify that setSearchQuery was called with the correct value
    expect(mockStore.setSearchQuery).toHaveBeenCalledWith('Harry Potter');
  });

  it('resets to first page when searching', async () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 2, // Start on page 2
      pageSize: 20,
      totalPages: 3,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Type in the search input
    await wrapper.find('.search-input').setValue('Harry Potter');
    
    // Verify that fetchBooks was called with page 1
    expect(mockStore.fetchBooks).toHaveBeenCalledWith(1);
  });

  it('shows search results', async () => {
    const mockBooks = [
      {
        id: 1,
        title: 'Harry Potter and the Philosopher\'s Stone',
        author: 'J.K. Rowling',
        has_cover: 1,
        format: 'epub'
      }
    ];

    const mockStore = {
      books: mockBooks,
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn(),
      getCoverUrl: vi.fn().mockReturnValue('/api/books/1/cover'),
      getDownloadUrl: vi.fn().mockReturnValue('/api/books/1/download')
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Type in the search input
    await wrapper.find('.search-input').setValue('Harry Potter');
    
    // Verify that the search results are displayed
    expect(wrapper.text()).toContain('Harry Potter and the Philosopher\'s Stone');
    expect(wrapper.text()).toContain('J.K. Rowling');
  });

  it('handles search with special characters', async () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Test various special characters
    const specialInputs = [
      'C++ Programming',
      'The "Great" Gatsby',
      'O\'Connor',
      '100% Complete',
      'Test & More'
    ];

    for (const input of specialInputs) {
      await wrapper.find('.search-input').setValue(input);
      expect(mockStore.setSearchQuery).toHaveBeenCalledWith(input);
    }
  });

  it('shows loading state during search', async () => {
    const mockStore = {
      books: [],
      loading: true,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Type in the search input
    await wrapper.find('.search-input').setValue('Test');
    
    // Verify loading state is shown
    expect(wrapper.text()).toContain('Loading books...');
  });

  it('handles search errors', async () => {
    const errorMessage = 'Failed to search books';
    const mockStore = {
      books: [],
      loading: false,
      error: errorMessage,
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Type in the search input
    await wrapper.find('.search-input').setValue('Test');
    
    // Verify error message is shown
    expect(wrapper.text()).toContain(errorMessage);
  });

  it('handles empty search results', async () => {
    const mockStore = {
      books: [],
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 20,
      totalPages: 0,
      fetchBooks: vi.fn(),
      setSearchQuery: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    // Type in the search input
    await wrapper.find('.search-input').setValue('Nonexistent Book');
    
    // Verify no books are shown
    expect(wrapper.find('.books-grid').exists()).toBe(false);
  });

  it('handles large search result sets', async () => {
    // Create a large array of mock books
    const mockBooks = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: `Book ${i + 1}`,
      author: 'Test Author',
      has_cover: 1,
      format: 'epub'
    }));

    // Mock the store with pagination
    const mockStore = {
      books: mockBooks.slice(0, 20), // Only return first page
      total: 100,
      loading: false,
      error: null,
      searchQuery: 'test',
      currentPage: 1,
      pageSize: 20,
      fetchBooks: vi.fn().mockResolvedValue({
        books: mockBooks.slice(0, 20),
        total: 100
      })
    };

    const wrapper = mount(BooksView, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            books: mockStore
          }
        })]
      }
    });

    // Wait for the component to update
    await flushPromises();

    // Verify only first page of results is shown
    const bookCards = wrapper.findAll('.book-card');
    expect(bookCards.length).toBe(20);
    expect(mockStore.fetchBooks).toHaveBeenCalledWith(1, 20, 'test');
  });
}); 