import express from 'express';
import http from 'http';
import { backupServiceExec } from './services/backup.service';
import { cleanServiceExec } from './services/clean.service';
import { updateServiceExec } from './services/update.service';
import { getProcessEnv } from './utils/utils-env-config';
import { logError, logInfo } from './utils/utils-logger';

const port = getProcessEnv().SWARM_UTILS_SERVER_PORT;

const expressApp = express();
const httpServer = http.createServer(expressApp);

expressApp.use(express.json());

expressApp.get('/update', async (req, res, _next) => {
  const tokenQuery = req.query.service;
  const serviceQuery = req.query.service;
  const registryAuthQuery = req.query.service;
  const imageQuery = req.query.service;

  if (typeof tokenQuery !== 'string' || tokenQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof serviceQuery !== 'string' || serviceQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    await updateServiceExec({
      token: tokenQuery,
      service: serviceQuery,
      registryAuth: typeof registryAuthQuery === 'string' && registryAuthQuery === 'true' ? true : false,
      image: typeof imageQuery === 'string' && imageQuery.length > 0 ? imageQuery : undefined,
    });
  } catch (err) {
    logError('request.update.API_ERROR', err, {
      query: req.query,
    });

    res.status(400).json({
      message: 'ApiError',
    });
    return;
  }

  res.json({
    message: 'Ok',
  });
});
expressApp.get('/backup', async (req, res, _next) => {
  const tokenQuery = req.query.service;
  const serviceQuery = req.query.service;

  if (typeof tokenQuery !== 'string' || tokenQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof serviceQuery !== 'string' || serviceQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    await backupServiceExec({
      token: tokenQuery,
      service: serviceQuery,
    });
  } catch (err) {
    logError('request.backup.API_ERROR', err, {
      query: req.query,
    });

    res.status(400).json({
      message: 'ApiError',
    });
    return;
  }

  res.json({
    message: 'Ok',
  });
});
expressApp.get('/clean', async (req, res, _next) => {
  const tokenQuery = req.query.service;
  const serviceQuery = req.query.service;

  if (typeof tokenQuery !== 'string' || tokenQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }
  if (typeof serviceQuery !== 'string' || serviceQuery.length === 0) {
    res.status(400).json({
      message: 'Incorrect request',
    });
    return;
  }

  try {
    await cleanServiceExec({
      token: tokenQuery,
      service: serviceQuery,
    });
  } catch (err) {
    logError('request.clean.API_ERROR', err, {
      query: req.query,
    });

    res.status(400).json({
      message: 'ApiError',
    });
    return;
  }

  res.json({
    message: 'Ok',
  });
});

httpServer.listen(port, () => {
  logInfo(`Service ready on port: ${port}`);
});
