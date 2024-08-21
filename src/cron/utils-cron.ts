import { CronJob } from 'cron';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { logError } from 'src/utils/utils-logger';
import { cronBackupServiceList } from './utils-cron-backup-service';
import { cronCleanNodeList } from './utils-cron-clean-node';
import { cronCleanServiceList } from './utils-cron-clean-service';

let isCronProgress = false;

export async function initCron() {
  const cronJob = new CronJob(getProcessEnv().SWARM_UTILS_CRON_EXPR, async () => {
    const dateCron = new Date();

    if (isCronProgress === false) {
      isCronProgress = true;

      if (getProcessEnv().SWARM_UTILS_IS_CRON_CLEAN_NODE === true) {
        await cronCleanNodeList(dateCron).catch((err) => {
          logError('CRON.cronCleanNodeList.ERR', err, {
            dateCron,
          });
        });
      }

      if (getProcessEnv().SWARM_UTILS_IS_CRON_CLEAN_SERVICE === true) {
        await cronCleanServiceList(dateCron).catch((err) => {
          logError('CRON.cronCleanServiceList.ERR', err, {
            dateCron,
          });
        });
      }

      if (getProcessEnv().SWARM_UTILS_IS_CRON_BACKUP_SERVICE === true) {
        await cronBackupServiceList(dateCron).catch((err) => {
          logError('CRON.cronBackupServiceList.ERR', err, {
            dateCron,
          });
        });
      }
    }
  });
  cronJob.start();
}
