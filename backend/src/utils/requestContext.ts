import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  sessionId?: string;
  userId?: string;
}

export const SESSION_HEADER = 'x-session-id';
export const SESSION_COOKIE_NAME = 'client_session_id';

const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function isValidSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}
