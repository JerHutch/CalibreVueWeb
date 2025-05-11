import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import appConfig from './src/app.config.json';

var proxPattern = `^${appConfig.apiUrl}`;
var baseUrl = `http://${appConfig.apiHost}:${appConfig.apiPort}`;

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
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: devServer
}); 