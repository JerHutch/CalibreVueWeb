<template>
  <div class="books-view">
    <h1>Books</h1>
    <div class="books-grid">
      <!-- Books will be displayed here -->
    </div>
  </div>
</template>

<script setup lang="ts">
// Component logic will be added here
</script>

<style scoped>
.books-view {
  padding: 20px;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}
</style> 