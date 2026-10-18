import { RequestHandler } from 'express';
import {
  RequestContext,
  SESSION_COOKIE_NAME,
  SESSION_HEADER,
  getContext,
  isValidSessionId,
  runWithContext
} from '../utils/requestContext';

const COOKIE_TRUSTED_PREFIX = '/api/auth/google';

function readCookie(header: unknown, name: string): string | undefined {
  if (typeof header !== 'string') {
    return undefined;
  }

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    if (part.slice(0, index).trim() !== name) {
      continue;
    }
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export const sessionContext: RequestHandler = (req, _res, next) => {
  const ctx: RequestContext = {};

  try {
    const headerValue = req.headers[SESSION_HEADER];
    if (isValidSessionId(headerValue)) {
      ctx.sessionId = headerValue;
    } else if ((req.originalUrl || '').startsWith(COOKIE_TRUSTED_PREFIX)) {
      const cookieValue = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
      if (isValidSessionId(cookieValue)) {
        ctx.sessionId = cookieValue;
      }
    }
  } catch {
    // An unreadable session id is ignored; it must never fail the request.
  }

  runWithContext(ctx, () => next());
};

export const attachUserToContext: RequestHandler = (req, _res, next) => {
  const ctx = getContext();
  const id = (req.user as { id?: unknown } | undefined)?.id;
  if (ctx && id !== undefined && id !== null) {
    ctx.userId = String(id);
  }
  next();
};
