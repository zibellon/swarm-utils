import express from 'express';
import http from 'http';
import { apiBackupRouter } from './modules/controllers/api-backup.controller';
import { apiCleanRouter } from './modules/controllers/api-clean.controller';
import { apiUpdateRouter } from './modules/controllers/api-update.controller';
import { getProcessEnv } from './utils/utils-env-config';
import { logInfo } from './utils/utils-logger';

const port = getProcessEnv().SWARM_UTILS_SERVER_PORT;

const expressApp = express();
const httpServer = http.createServer(expressApp);

expressApp.use(express.json());

expressApp.use(apiUpdateRouter);
expressApp.use(apiBackupRouter);
expressApp.use(apiCleanRouter);

httpServer.listen(port, () => {
  logInfo(`Service ready on port: ${port}`);
});
