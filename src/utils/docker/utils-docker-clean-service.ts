import { getProcessEnv } from '../utils-env-config';
import { lockGetTimeoutCleanService, lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { nameCleanServiceExec, nameLock } from '../utils-names';
import { dockerCheckAndRmHelpServicesForService, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  DockerApiInspectServiceItem,
  dockerApiInspectTask,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServicePs,
  DockerApiServicePsItem,
} from './utils-docker-api';
import { dockerLogInspectServiceItem, dockerLogInspectTaskItem } from './utils-docker-logs';

export async function dockerCleanServiceList(serviceList: DockerApiServiceLsItem[]) {
  for (const serviceItem of serviceList) {
    logInfo('dockerCleanServiceList.serviceItem.INIT', {
      serviceItem,
    });

    let inspectServiceInfo: DockerApiInspectServiceItem | null = null;
    try {
      inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    } catch (err) {
      logError('dockerCleanServiceList.serviceItem.dockerApiInspectService.ERR', {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      logWarn('dockerCleanServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    let taskList: DockerApiServicePsItem[] | null = null;
    try {
      taskList = await dockerApiServicePs(serviceItem.Name, [
        {
          key: 'desired-state',
          value: 'Running', // Только АКТИВНЫЕ таски
        },
      ]);
    } catch (err) {
      logError('dockerCleanServiceList.serviceItem.dockerApiServicePs.ERR', {
        serviceItem,
      });
    }
    if (taskList === null || taskList.length === 0) {
      logWarn('dockerCleanServiceList.serviceItem.taskList.NULL_OR_EMPTY', {
        serviceItem,
      });
      continue;
    }

    const lockTimeoutObj = lockGetTimeoutCleanService({
      execTimeout: getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT * taskList.length,
    });
    const lockKey = nameLock(serviceItem.Name);

    const logData = {
      lockKey,
      lockTimeoutObj,
      serviceItem,
      inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
      taskList,
    };

    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerCleanServiceList.serviceItem.lock.OK', logData);
          await dockerCleanServiceItem(serviceItem, inspectServiceInfo!, taskList!);
          logInfo('dockerCleanServiceList.serviceItem.OK', logData);
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerCleanServiceList.serviceItem.ERR', err, logData);
      });
  }
}

async function dockerCleanServiceItem(
  serviceItem: DockerApiServiceLsItem,
  inspectServiceInfo: DockerApiInspectServiceItem,
  taskList: DockerApiServicePsItem[]
) {
  const logData = {
    serviceItem,
    inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
  };
  logInfo('dockerCleanServiceItem.INIT', logData);

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
  logInfo('dockerCleanServiceItem.EXEC_LABEL_OBJ', {
    ...logData,
    execLabelObj,
  });

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(serviceItem.Name);

  //---------
  // EXEC
  //---------
  for (const taskItem of taskList) {
    const logData2 = {
      ...logData,
      execLabelObj,
      taskItem,
    };
    try {
      logInfo('dockerCleanServiceItem.taskItem.exec.INIT', logData2);
      // Проверка и удаление всех сервисов + ThrowError
      await dockerCheckAndRmHelpServicesForService(serviceItem.Name);
      // Непосредственно EXEC
      await dockerCleanServiceItemExecOnTask(serviceItem, taskItem, execLabelObj[1]);
      logInfo('dockerCleanServiceItem.taskItem.exec.OK', logData2);
    } catch (err) {
      logError('dockerCleanServiceItem.taskItem.exec.ERR', err, logData2);
    }
  }
}

async function dockerCleanServiceItemExecOnTask(
  serviceItem: DockerApiServiceLsItem,
  taskItem: DockerApiServicePsItem,
  execCommand: string
) {
  const logData = {
    serviceItem,
    taskItem,
    execCommand,
  };
  logInfo('dockerCleanServiceItemExecOnTask.INIT', logData);

  const taskInspectInfo = await dockerApiInspectTask(taskItem.ID);
  if (!taskInspectInfo) {
    logWarn('dockerCleanServiceItemExecOnTask.taskInspect.NULL', {
      serviceItem,
      taskItem,
    });
    return;
  }

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = taskInspectInfo.Status.ContainerStatus.ContainerID;
  const nodeId = taskInspectInfo.NodeID;

  logInfo('dockerCleanServiceItemExecOnTask.TASK_INSPECT', {
    ...logData,
    taskInspectInfo: dockerLogInspectTaskItem(taskInspectInfo),
    containerId,
    nodeId,
  });

  //---------
  //EXEC
  //---------
  const cleanServiceExecServiceName = nameCleanServiceExec(serviceItem.Name);
  const dockerExecShell = getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_SHELL;
  const dockerExecCommand = `docker exec ${containerId} ${dockerExecShell} -c '${execCommand}'`;
  const logData2 = {
    ...logData,
    containerId,
    nodeId,
    serviceName: cleanServiceExecServiceName,
    dockerExecCommand,
  };
  logInfo('dockerCleanServiceItemExecOnTask.exec.SERVICE_CREATE', logData2);
  await dockerApiServiceCreate({
    detach: true,
    name: cleanServiceExecServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${nodeId}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: dockerExecCommand,
  });
  logInfo('dockerCleanServiceItemExecOnTask.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    cleanServiceExecServiceName,
    getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT
  );
  logInfo('dockerCleanServiceItemExecOnTask.exec.OK', logData2);
}
