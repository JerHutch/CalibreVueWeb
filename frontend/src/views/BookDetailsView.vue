<template>
  <div class="book-details">
    <h1>Book Details</h1>
    <div class="book-content">
      <!-- Book details will be implemented here -->
      <p>Book details coming soon...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const bookId = route.params.id;
</script>

<style scoped>
.book-details {
  padding: 2rem;
}

.book-content {
  margin-top: 2rem;
}
</style> 