import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookCard from '@/components/BookCard.vue';
import { useBookStore, type Book } from '@/stores/bookStore';

const createBook = (overrides: Partial<Book> = {}): Book => ({
  id: 1,
  title: 'Test Title',
  author: 'Test Author',
  publisher: 'Test Publisher',
  pubdate: '2024-01-15T00:00:00.000Z',
  isbn: '1234567890123',
  path: '/books/test.epub',
  has_cover: 1,
  timestamp: '2024-01-15T00:00:00.000Z',
  last_modified: '2024-01-15T00:00:00.000Z',
  series_index: 2,
  series: 'Test Series',
  language: 'en',
  format: 'epub',
  ...overrides,
});

describe('BookCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders cover metadata for books with a cover', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          isDownloading: false,
          downloadProgress: 0,
          downloadError: null,
        },
      },
    });
    const store = useBookStore(pinia);
    store.getCoverUrl.mockResolvedValue('blob:cover-url');

    const wrapper = mount(BookCard, {
      global: { plugins: [pinia] },
      props: { book: createBook() },
    });

    await flushPromises();

    expect(store.getCoverUrl).toHaveBeenCalledWith(1);
    expect(wrapper.get('img').attributes('src')).toBe('blob:cover-url');
    expect(wrapper.text()).toContain('Test Title');
    expect(wrapper.text()).toContain('Test Author');
    expect(wrapper.text()).toContain('Test Series #2');
    expect(wrapper.text()).toContain('2024');
    expect(wrapper.get('button').text()).toContain('Download EPUB');
  });

  it('downloads the current book when the action button is clicked', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          isDownloading: false,
          downloadProgress: 0,
          downloadError: null,
        },
      },
    });
    const store = useBookStore(pinia);

    const wrapper = mount(BookCard, {
      global: { plugins: [pinia] },
      props: { book: createBook() },
    });

    await wrapper.get('button').trigger('click');

    expect(store.downloadBook).toHaveBeenCalledWith(1, 'Test Title.epub');
  });

  it('reflects active download state from the store', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        book: {
          isDownloading: true,
          downloadProgress: 42,
          downloadError: 'Download failed',
        },
      },
    });

    const wrapper = mount(BookCard, {
      global: { plugins: [pinia] },
      props: { book: createBook() },
    });

    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Downloading... 42%');
    expect(wrapper.text()).toContain('Download failed');
  });

  it('omits cover and download controls when book data does not support them', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    });
    const store = useBookStore(pinia);

    const wrapper = mount(BookCard, {
      global: { plugins: [pinia] },
      props: {
        book: createBook({
          has_cover: 0,
          format: '',
          publisher: '',
          pubdate: '',
          series: '',
        }),
      },
    });

    await flushPromises();

    expect(store.getCoverUrl).not.toHaveBeenCalled();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Test Publisher');
  });
});
