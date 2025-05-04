<template>
  <div class="login-view">
    <div class="login-container">
      <h1>Login</h1>
      <div class="login-options">
        <button class="login-button google" @click="loginWithGoogle">
          Login with Google
        </button>
        <button class="login-button github" @click="loginWithGithub">
          Login with GitHub
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const loginWithGoogle = () => {
  window.location.href = '/api/auth/google';
};

const loginWithGithub = () => {
  window.location.href = '/api/auth/github';
};
</script>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.login-container {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.login-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.login-button {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.login-button.google {
  background: #4285f4;
  color: white;
}

.login-button.github {
  background: #24292e;
  color: white;
}

.login-button:hover {
  opacity: 0.9;
}
</style> 