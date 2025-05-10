<template>
  <div class="books-view">
    <h1>Books</h1>
    
    <div v-if="bookStore.loading" class="loading">
      Loading books...
    </div>
    
    <div v-else-if="bookStore.error" class="error">
      {{ bookStore.error }}
    </div>
    
    <div v-else>
      <div class="books-grid">
        <div v-for="book in bookStore.books" :key="book.id" class="book-card">
          <div class="book-cover" v-if="book.has_cover">
            <img :src="`/api/books/${book.id}/cover`" :alt="book.title">
          </div>
          <div class="book-info">
            <h3>{{ book.title }}</h3>
            <p class="author">{{ book.author }}</p>
            <p v-if="book.series" class="series">
              {{ book.series }} #{{ book.series_index }}
            </p>
            <div class="book-meta">
              <span v-if="book.publisher">{{ book.publisher }}</span>
              <span v-if="book.pubdate">{{ new Date(book.pubdate).getFullYear() }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination">
        <button 
          :disabled="bookStore.currentPage === 1"
          @click="changePage(bookStore.currentPage - 1)"
        >
          Previous
        </button>
        <span>Page {{ bookStore.currentPage }} of {{ bookStore.totalPages }}</span>
        <button 
          :disabled="bookStore.currentPage >= bookStore.totalPages"
          @click="changePage(bookStore.currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useBookStore } from '@/stores/book';

const bookStore = useBookStore();

const changePage = (page: number) => {
  bookStore.fetchBooks(page, bookStore.pageSize);
};

onMounted(() => {
  bookStore.fetchBooks();
});
</script>

<style scoped>
.books-view {
  padding: 2rem;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #dc3545;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.book-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.2s;
}

.book-card:hover {
  transform: translateY(-4px);
}

.book-cover {
  aspect-ratio: 2/3;
  background: #f5f5f5;
  overflow: hidden;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.book-info {
  padding: 1rem;
}

.book-info h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  line-height: 1.4;
}

.author {
  color: #666;
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}

.series {
  color: #2c3e50;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}

.book-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #666;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  background-color: #2c3e50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.pagination span {
  font-size: 0.9rem;
  color: #666;
}
</style> 