<template>
  <div class="books-view">
    <h1>Books</h1>
    
    <div v-if="bookStore.loading" class="loading">
      Loading books...
    </div>
    
    <div v-else-if="bookStore.error" class="error">
      {{ bookStore.error }}
    </div>
    
    <div v-else class="books-grid">
      <BookCard
        v-for="book in bookStore.books"
        :key="book.id"
        :book="book"
      />
    </div>

    <div class="pagination">
      <button 
        :disabled="bookStore.currentPage === 1"
        @click="bookStore.fetchBooks(bookStore.currentPage - 1)"
      >
        Previous
      </button>
      <span>Page {{ bookStore.currentPage }} of {{ bookStore.totalPages }}</span>
      <button 
        :disabled="bookStore.currentPage === bookStore.totalPages"
        @click="bookStore.fetchBooks(bookStore.currentPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useBookStore } from '@/stores/book';
import BookCard from '@/components/BookCard.vue';

const bookStore = useBookStore();

onMounted(() => {
  bookStore.fetchBooks();
});
</script>

<style scoped>
.books-view {
  padding: 1rem;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.error {
  color: #dc3545;
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
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.pagination span {
  color: #666;
}
</style> 