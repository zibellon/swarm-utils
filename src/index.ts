import express from 'express';
import http from 'http';
import { initCron } from './cron/utils-cron';
import { apiBackupRouter } from './modules/controllers/api-backup.controller';
import { apiCleanRouter } from './modules/controllers/api-clean.controller';
import { apiUpdateRouter } from './modules/controllers/api-update.controller';
import { apiLogger } from './utils/utils-api-logger';
import { getProcessEnv } from './utils/utils-env-config';
import { logError, logInfo } from './utils/utils-logger';

const port = getProcessEnv().SWARM_UTILS_SERVER_PORT;

const expressApp = express();
const httpServer = http.createServer(expressApp);

async function bootstrap() {
  expressApp.use(express.json());

  expressApp.use(apiLogger);

  expressApp.use(apiUpdateRouter);
  expressApp.use(apiBackupRouter);
  expressApp.use(apiCleanRouter);

  initCron();

  httpServer.listen(port, () => {
    logInfo(`Service ready on port: ${port}`);
  });
}

bootstrap()
  .then(() => {
    logInfo('bootstrap.OK');
  })
  .catch((err) => {
    logError('bootstrap.ERR', err);
    throw err;
  });
