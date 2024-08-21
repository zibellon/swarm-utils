import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { nameCleanServiceExec, nameLock } from '../utils-names';
import { dockerCheckAndRemoveSupportServices, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  DockerApiInspectServiceItem,
  dockerApiInspectTask,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServicePs,
  DockerApiServicePsItem,
} from './utils-docker-api';

export async function dockerCleanServiceList(serviceList: DockerApiServiceLsItem[]) {
  for (const serviceItem of serviceList) {
    //TODO - работа с ошибками
    const inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    if (inspectServiceInfo === null) {
      logWarn('dockerCleanServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    //TODO - работа с ошибками
    const taskList = await dockerApiServicePs(serviceItem.Name, [
      {
        key: 'desired-state',
        value: 'Running', // Только АКТИВНЫЕ таски
      },
    ]);

    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT * taskList.length +
      getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;

    const lockKey = nameLock(serviceItem.Name);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          await dockerCleanServiceItem(serviceItem, inspectServiceInfo, taskList);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerCleanServiceList.serviceItem.ERR', err, {
          serviceItem,
        });
      });
  }
}

async function dockerCleanServiceItem(
  serviceItem: DockerApiServiceLsItem,
  inspectServiceInfo: DockerApiInspectServiceItem,
  taskList: DockerApiServicePsItem[]
) {
  logInfo('dockerCleanServiceItem.INIT', {
    serviceItem,
  });
  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRemoveSupportServices(serviceItem.Name);

  // 'traefik.http.routers.router-test-back-dev-http.entryPoints': 'web';
  // Поиск label - где такой ключ и есть значение
  const execLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.clean.exec' && el[1].length > 0;
  });
  if (!execLabelObj) {
    logWarn('cronCleanServiceItem.execLabelObj.NULL', {
      serviceItem,
    });
    return;
  }

  // Получить список всех TASK для этого service
  for (const taskItem of taskList) {
    await dockerCleanServiceItemExecOnTask(serviceItem, taskItem, execLabelObj[1]);
  }
}

async function dockerCleanServiceItemExecOnTask(
  serviceItem: DockerApiServiceLsItem,
  taskItem: DockerApiServicePsItem,
  execCommand: string
) {
  logInfo('cronCleanServiceItemExecOnTask.INIT', {
    serviceItem,
    taskItem,
  });

  const taskInspect = await dockerApiInspectTask(taskItem.ID);
  if (!taskInspect) {
    logWarn('cronCleanServiceItemExecOnTask.taskInspect.NULL', {
      serviceItem,
      taskItem,
    });
    return;
  }

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = taskInspect.Status.ContainerStatus.ContainerID;

  //---------
  //EXEC
  //---------
  const cleanServiceExecServiceName = nameCleanServiceExec(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: cleanServiceExecServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${taskInspect.NodeID}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execCommand: `docker exec ${containerId} /bin/sh -c '${execCommand}'`, // From label
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    cleanServiceExecServiceName,
    getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT
  );
}
