import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

const REDACTED_VALUE = '********';

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey === 'authorization' ||
    normalizedKey === 'cookie' ||
    normalizedKey === 'set-cookie' ||
    normalizedKey.includes('token') ||
    normalizedKey.includes('secret') ||
    normalizedKey.includes('key') ||
    normalizedKey === 'password'
  );
};

const maskSensitiveData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  
  Object.keys(masked).forEach(key => {
    if (isSensitiveKey(key)) {
      masked[key] = REDACTED_VALUE;
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });
  
  return masked;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request details
  logger.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  logger.info('Headers: ' + JSON.stringify(maskSensitiveData(req.headers), null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info('Body: ' + JSON.stringify(maskSensitiveData(req.body), null, 2));
  }
  // log blank line
  logger.info('');
  

  // Log response details when the response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};
