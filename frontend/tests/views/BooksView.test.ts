import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BooksView from '@/views/BooksView.vue';
import { useBookStore, type Book } from '@/stores/bookStore';

vi.mock('@/components/BookCard.vue', () => ({
  default: {
    name: 'BookCard',
    props: ['book'],
    template: '<div class="book-card-stub">{{ book.title }}</div>',
  },
}));

const createBook = (id: number): Book => ({
  id,
  title: `Book ${id}`,
  author: `Author ${id}`,
  publisher: 'Publisher',
  pubdate: '2024-01-15T00:00:00.000Z',
  isbn: `${id}`.padStart(13, '0'),
  path: `/books/${id}.epub`,
  has_cover: 1,
  timestamp: '2024-01-15T00:00:00.000Z',
  last_modified: '2024-01-15T00:00:00.000Z',
  series_index: 1,
  series: 'Series',
  language: 'en',
  format: 'epub',
});

describe('BooksView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches books on mount and renders results', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          books: [createBook(1), createBook(2)],
          loading: false,
          error: null,
          currentPage: 2,
          total: 80,
          pageSize: 20,
        },
      },
      stubActions: false,
    });
    const store = useBookStore(pinia);
    store.fetchBooks = vi.fn();

    const wrapper = mount(BooksView, {
      global: { plugins: [pinia] },
    });

    expect(store.fetchBooks).toHaveBeenCalledWith();
    expect(wrapper.text()).toContain('Book 1');
    expect(wrapper.text()).toContain('Book 2');
    expect(wrapper.text()).toContain('Page 2 of 4');
  });

  it('updates search and pagination through the store', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          books: [],
          loading: false,
          error: null,
          currentPage: 2,
          total: 60,
          pageSize: 20,
        },
      },
    });
    const store = useBookStore(pinia);

    const wrapper = mount(BooksView, {
      global: { plugins: [pinia] },
    });

    const input = wrapper.get('input');
    await input.setValue('asimov');

    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(store.setSearchQuery).toHaveBeenLastCalledWith('asimov');
    expect(store.fetchBooks).toHaveBeenNthCalledWith(2, 1);
    expect(store.fetchBooks).toHaveBeenNthCalledWith(3, 3);
  });

  it('renders loading, error, and pagination edge states', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          books: [],
          loading: true,
          error: null,
          currentPage: 1,
          total: 20,
          pageSize: 20,
        },
      },
    });

    const wrapper = mount(BooksView, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.text()).toContain('Loading books...');
    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined();
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined();

    const store = useBookStore(pinia);
    store.loading = false;
    store.error = 'Backend failed';
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Backend failed');
  });
});
