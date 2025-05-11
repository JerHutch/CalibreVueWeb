import { Request, Response, NextFunction } from 'express';

const maskSensitiveData = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked = { ...obj };
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  
  Object.keys(masked).forEach(key => {
    if (sensitiveFields.includes(key.toLowerCase())) {
      masked[key] = '********';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  });
  
  return masked;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request details
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(maskSensitiveData(req.body), null, 2));
  }
  // log blank line
  console.log('');
  

  // Log response details when the response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
}; 