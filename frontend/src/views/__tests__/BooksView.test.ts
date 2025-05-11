import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BooksView from '../BooksView.vue';
import { useBookStore } from '../../stores/book';
import { faker } from '@faker-js/faker';

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
}); 