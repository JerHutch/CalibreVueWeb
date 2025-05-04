<template>
  <div class="pending-view">
    <div class="pending-container">
      <h1>Account Pending Approval</h1>
      <p>Your account is pending approval from an administrator. You will be notified once your account is approved.</p>
      <div class="pending-info">
        <p>In the meantime, you can:</p>
        <ul>
          <li>Check your email for updates</li>
          <li>Contact the administrator if you have any questions</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Component logic will be added here
</script>

<style scoped>
.pending-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.pending-container {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
}

.pending-info {
  margin-top: 20px;
  text-align: left;
}

ul {
  list-style-type: none;
  padding: 0;
  margin-top: 10px;
}

li {
  margin: 10px 0;
  padding-left: 20px;
  position: relative;
}

li:before {
  content: "•";
  position: absolute;
  left: 0;
  color: #666;
}
</style> 