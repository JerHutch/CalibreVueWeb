<script>
export default {
  name: 'OAuthLoginView',
  methods: {
    handleGoogleLogin() {
      window.location.href = '/api/auth/google'
    }
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Welcome</h1>
      <p class="subtitle">Sign in to continue</p>
      
      <button 
        @click="handleGoogleLogin" 
        class="google-login-btn"
      >
        <img 
          src="https://www.google.com/favicon.ico" 
          alt="Google logo" 
          class="google-icon"
        />
        Sign in with Google
      </button>
    </div>
  </div>
</template>



<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 400px;
}

h1 {
  color: #333;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.google-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.google-login-btn:hover {
  background-color: #f8f8f8;
}

.google-icon {
  width: 18px;
  height: 18px;
}
</style>
