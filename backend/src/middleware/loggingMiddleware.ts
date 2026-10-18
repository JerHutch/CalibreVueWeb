import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { sanitizeUrl } from '../utils/redact';

const CLIENT_LOGS_PREFIX = '/api/client-logs';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  try {
    const start = Date.now();
    const rawPath = (req.originalUrl || '').split('?', 1)[0];

    if (!rawPath.startsWith(CLIENT_LOGS_PREFIX)) {
      res.on('finish', () => {
        try {
          const path = sanitizeUrl(req.originalUrl);
          const status = res.statusCode;
          const durationMs = Date.now() - start;

          logger.info(`${req.method} ${path} ${status}`, {
            event: 'http.request',
            details: { method: req.method, path, status, durationMs }
          });
        } catch {
          // Logging must never affect the request.
        }
      });
    }
  } catch {
    // Logging must never affect the request.
  }

  next();
};
