import axios from 'axios';
import appConfig from '@/app.config.json';
import { clientLog, describeError } from '@/logging/clientLogger';
import { SESSION_HEADER, getSessionId } from '@/logging/sessionId';

const api = axios.create({
  baseURL: appConfig.apiUrl,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  try {
    config.headers.set(SESSION_HEADER, getSessionId());
  } catch {
    // never block a request because of logging correlation
  }
  return config;
});

function logFailedRequest(error: unknown): void {
  try {
    if (axios.isCancel(error)) {
      return;
    }
    const details = describeError(error);
    const status = typeof details.status === 'number' ? details.status : undefined;
    const level = status === 401 || status === 403 ? 'warn' : 'error';
    const method = details.method ?? 'REQUEST';
    const path = details.path ?? '';
    clientLog(
      level,
      'http.failed',
      `${method} ${path} failed (${status ?? 'network error'})`,
      details
    );
  } catch {
    // logging must never alter the rejection
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    logFailedRequest(error);
    return Promise.reject(error);
  }
);

export default api;
