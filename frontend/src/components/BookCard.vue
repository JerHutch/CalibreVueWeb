<template>
  <div class="book-card">
    <div class="book-cover" v-if="book.has_cover">
      <img :src="coverUrl" :alt="book.title">
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
      <div class="book-actions">
        <button 
          v-if="book.format"
          @click="handleDownload"
          class="download-button"
          :disabled="isDownloading"
        >
          <span v-if="isDownloading">
            Downloading... {{ downloadProgress }}%
          </span>
          <span v-else>
            Download {{ book.format.toUpperCase() }}
          </span>
        </button>
        <div v-if="downloadError" class="error-message">
          {{ downloadError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useBookStore } from '@/stores/book';
import type { Book } from '@/stores/book';

const props = defineProps<{
  book: Book;
}>();

const bookStore = useBookStore();
const coverUrl = ref('');

onMounted(async () => {
  if (props.book.has_cover) {
    coverUrl.value = await bookStore.getCoverUrl(props.book.id);
  }
});

const handleDownload = async () => {
  await bookStore.downloadBook(
    props.book.id,
    `${props.book.title}.${props.book.format}`
  );
};

// Expose download state from the store
const isDownloading = computed(() => bookStore.isDownloading);
const downloadProgress = computed(() => bookStore.downloadProgress);
const downloadError = computed(() => bookStore.downloadError);
</script>

<style scoped>
.book-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.book-cover img {
  max-width: 150px;
  height: auto;
  border-radius: 4px;
}

.book-info {
  flex: 1;
}

.book-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

.author {
  color: #666;
  margin: 0 0 0.5rem 0;
}

.series {
  color: #666;
  font-style: italic;
  margin: 0 0 0.5rem 0;
}

.book-meta {
  display: flex;
  gap: 1rem;
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.book-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.download-button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.download-button:hover:not(:disabled) {
  background-color: #45a049;
}

.download-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  font-size: 0.9rem;
}
</style> 