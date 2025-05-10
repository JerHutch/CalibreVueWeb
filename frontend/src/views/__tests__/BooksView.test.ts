import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BooksView from '../BooksView.vue';
import { useBookStore } from '@/stores/book';
import { faker } from '@faker-js/faker';

// Mock the book store
vi.mock('@/stores/book', () => ({
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
      fetchBooks: vi.fn()
    };

    (useBookStore as any).mockReturnValue(mockStore);

    const wrapper = mount(BooksView);
    
    expect(wrapper.find('.books-grid').exists()).toBe(true);
    expect(wrapper.find('.book-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('Test Book');
    expect(wrapper.text()).toContain('Test Author');
    expect(wrapper.text()).toContain('Test Series');
    expect(wrapper.text()).toContain(pubDate.getFullYear().toString());
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