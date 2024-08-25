import { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { logInfo } from './utils-logger';

export function apiLogger(req: Request, _: Response, next: NextFunction) {
  if (req.url.includes('/swagger')) {
    next();
    return;
  }

  const tmp = req as any;

  tmp.logData = {
    reqId: nanoid(32),
    reqUrl: req.url,
    reqMethod: req.method,
  };

  if (req.body) {
    tmp.logData['reqBody'] = req.body;
  }

  if (req.query) {
    tmp.logData['reqQuery'] = req.query;
  }

  if (req.headers) {
    tmp.logData['reqHeaders'] = req.headers;
  }

  logInfo('REQ logger', tmp.logData);

  next();
}
