import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { installGlobalErrorHandlers } from '@/logging/clientLogger';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);


app.use(router);
installGlobalErrorHandlers(app);
app.mount('#app');
