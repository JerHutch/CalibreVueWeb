import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import appConfig from './src/app.config.json';
import tailwindcss from '@tailwindcss/vite';

var proxPattern = `^${appConfig.apiUrl}`;
// Use environment variable for API host, fallback to config
var apiHost = process.env.VITE_API_HOST || appConfig.apiHost;
var baseUrl = `http://${apiHost}:${appConfig.apiPort}`;

var devServer = {
  port: 8888,
  proxy: {},
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
  }
}

var devProxy = {
  target: baseUrl,
  changeOrigin: true,
  secure: false,
  logLevel: 'debug'
}

devServer.proxy[proxPattern] = devProxy;

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: devServer
}); 