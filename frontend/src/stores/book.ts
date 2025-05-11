import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';
import { useFileDownload } from '@/composables/useFileDownload';

export interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string;
  pubdate: string;
  isbn: string;
  path: string;
  has_cover: number;
  timestamp: string;
  last_modified: string;
  series_index: number;
  series: string;
  language: string;
  format: string;
}

export const useBookStore = defineStore('book', () => {
  // State
  const books = ref<Book[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentPage = ref(1);
  const pageSize = ref(20);

  // File download composable
  const { downloadFile, isDownloading, downloadError, downloadProgress } = useFileDownload();

  // Computed
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

  // Actions
  async function fetchBooks(page: number = 1, limit: number = 20) {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/books', {
        params: { page, limit }
      });
      books.value = response.data.books;
      total.value = response.data.total;
      currentPage.value = page;
      pageSize.value = limit;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch books';
      console.error('Error fetching books:', err);
    } finally {
      loading.value = false;
    }
  }

  // Helper functions
  async function getCoverUrl(bookId: number): Promise<string> {
    try {
      const response = await api.get(`/books/${bookId}/cover`, {
        responseType: 'blob'
      });
      return URL.createObjectURL(response.data);
    } catch (err) {
      console.error('Error fetching book cover:', err);
      return '';
    }
  }

  async function downloadBook(bookId: number, filename: string) {
    return downloadFile(`/books/${bookId}/download`, { filename });
  }

  return {
    // State
    books,
    total,
    loading,
    error,
    currentPage,
    pageSize,
    // Download state
    isDownloading,
    downloadError,
    downloadProgress,
    // Computed
    totalPages,
    // Actions
    fetchBooks,
    // Helper functions
    getCoverUrl,
    downloadBook
  };
}); 