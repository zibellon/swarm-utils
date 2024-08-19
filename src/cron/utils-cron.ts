import { CronJob } from 'cron';
import { dockerServiceGetStatusInfo } from 'src/utils/docker/utils-docker';
import { dockerApiNodeLs, dockerApiServiceRemove } from 'src/utils/docker/utils-docker-api';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockResource } from 'src/utils/utils-lock';
import { logError } from 'src/utils/utils-logger';
import { nameCleanNode } from 'src/utils/utils-names';

let isCronProgress = false;

export async function initCron() {
  const cronJob = new CronJob(getProcessEnv().SWARM_UTILS_CRON_EXPR, async () => {
    const dateCron = new Date();

    if (isCronProgress === false) {
      isCronProgress = true;
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

async function cronCleanProgress(dateCron: Date) {
  // Очистка Node
  const nodeList = await dockerApiNodeLs();
  for (const node of nodeList) {
    const lockKey = nameCleanNode(node.Hostname);
    await lockResource
      .acquire(lockKey, async () => {
        const serviceName = nameCleanNode(node.Hostname);

        // Вынести в общий метод - аля:

        let canContinue = true;

        const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);
        if (serviceStatusInfo.isExist) {
          if (serviceStatusInfo.canRemove) {
            // Сервис существует и его МОЖНО удалить
            await dockerApiServiceRemove(serviceName);
          } else {
            canContinue = false;
          }
        }

        // Запуск сервиса для очистки
        // docker service create ...

        // Дождаться пока завершится + Удалить сервис
        // while ....
      })
      .catch((err) => {
        logError('cronCleanProgress.for.nodeList.ERR', err, {
          ...node,
        });
      });
  }

  // Очистка Containers (Example: registry-clean)
  //...
}

async function cronBackupProgress(dateCron: Date) {}
