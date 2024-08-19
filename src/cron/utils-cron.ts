import { CronJob } from 'cron';
import { dockerServiceGetStatusInfo } from 'src/utils/docker/utils-docker';
import { dockerApiNodeLs, dockerApiServiceLs, dockerApiServiceRemove } from 'src/utils/docker/utils-docker-api';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockResource } from 'src/utils/utils-lock';
import { logError } from 'src/utils/utils-logger';
import { cronCleanNodeList } from './utils-cron-clean-node';

let isCronProgress = false;

export async function initCron() {
  const cronJob = new CronJob(getProcessEnv().SWARM_UTILS_CRON_EXPR, async () => {
    const dateCron = new Date();

    if (isCronProgress === false) {
      isCronProgress = true;

      await cronCleanNodeList(dateCron).catch((err) => {
        logError('CRON.cronCleanNodeList.ERR', err, {
          dateCron,
        });
      });

      
    }
  });

  cronJob.start();
}

// execServiceName="docker_backuper_exec"
// execCommand="docker exec $containerId /bin/sh -c '$execLabel'"

// docker service create \
//   --detach \
//   --name $execServiceName \
//   --mode replicated \
//   --replicas 1 \
//   --constraint node.hostname==$taskNode \
//   --restart-condition none \
//   --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly \
//   docker:25.0.5-cli-alpine3.20 sh -c "$execCommand"

// # While loop here
// waitForServiceComplete $execServiceName

// docker service logs $execServiceName
// docker service remove $execServiceName

async function cronCleanServiceListProgress(dateCron: Date) {
  const serviceList = await dockerApiServiceLs([
    {
      key: 'label',
      value: '',
    },
  ]);
  for (const service of serviceList) {
  }
}

async function cronBackupProgress(dateCron: Date) {}
