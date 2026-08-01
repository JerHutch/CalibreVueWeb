import axios from 'axios';
import appConfig from '@/app.config.json';

const api = axios.create({
  baseURL: appConfig.apiUrl,
  withCredentials: true
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
