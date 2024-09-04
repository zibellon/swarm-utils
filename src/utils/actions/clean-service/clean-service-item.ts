import {
  dockerCheckAndRmHelpServices,
  dockerCheckAndRmHelpServicesForService,
  dockerHelpServiceCompleteInfo,
  DockerHelpServiceCompleteRes,
  dockerWaitForServiceComplete,
} from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectServiceItem,
  dockerApiInspectTask,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  DockerApiServicePsItem,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectServiceItem, maskInspectTaskItem } from 'src/utils/docker/utils-docker-mask';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { throwErrorSimple } from 'src/utils/utils-error';
import { logError, logInfo } from 'src/utils/utils-logger';
import { nameCleanServiceExec } from 'src/utils/utils-names';

type DockerCleanServiceItemParams = {
  serviceItem: DockerApiServiceLsItem;
  inspectServiceInfo: DockerApiInspectServiceItem;
  taskList: DockerApiServicePsItem[];
};
export async function dockerCleanServiceItem(params: DockerCleanServiceItemParams) {
  const logData = {
    serviceItem: params.serviceItem,
    inspectServiceInfo: maskInspectServiceItem(params.inspectServiceInfo),
  };
  logInfo('dockerCleanServiceItem.INIT', logData);

  // 'traefik.http.routers.router-test-back-dev-http.entryPoints': 'web';
  // Поиск label - где такой ключ и есть значение
  const execLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.clean.exec' && el[1].length > 0;
  });
  if (!execLabelObj) {
    throwErrorSimple('cronCleanServiceItem.execLabelObj.NULL', logData);
  }

  logInfo('dockerCleanServiceItem.EXEC_LABEL_OBJ', {
    ...logData,
    execLabelObj,
  });

  const execShellLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.clean.exec.shell' && el[1].length > 0;
  });

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(params.serviceItem.Name);

  //---------
  // EXEC
  //---------
  const helpServiceCompleteResultList: DockerHelpServiceCompleteRes[] = [];
  for (const taskItem of params.taskList) {
    const logData2 = {
      ...logData,
      execLabelObj,
      taskItem,
    };
    try {
      logInfo('dockerCleanServiceItem.taskItem.exec.INIT', logData2);
      // Непосредственно EXEC
      const helpServiceCompleteResult = await dockerCleanServiceItemExecOnTask({
        serviceItem: params.serviceItem,
        taskItem,
        execCommand: execLabelObj[1],
        execShell: execShellLabelObj ? execShellLabelObj[1] : getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_SHELL,
      });
      helpServiceCompleteResultList.push(helpServiceCompleteResult);
      logInfo('dockerCleanServiceItem.taskItem.exec.OK', logData2);
    } catch (err) {
      logError('dockerCleanServiceItem.taskItem.exec.ERR', err, logData2);
    }
  }
  return helpServiceCompleteResultList;
}

type DockerCleanServiceItemExecOnTaskParams = {
  serviceItem: DockerApiServiceLsItem;
  taskItem: DockerApiServicePsItem;
  execCommand: string;
  execShell: string;
};
async function dockerCleanServiceItemExecOnTask(params: DockerCleanServiceItemExecOnTaskParams) {
  const logData = {
    ...params,
  };
  logInfo('dockerCleanServiceItemExecOnTask.INIT', logData);

  const inspectTaskInfo = await dockerApiInspectTask(params.taskItem.ID);
  if (!inspectTaskInfo) {
    throwErrorSimple('dockerCleanServiceItemExecOnTask.taskInspect.NULL', logData);
  }

  const execServiceName = nameCleanServiceExec(params.serviceItem.Name);
  // Проверка и удаление сервиса + ThrowError
  await dockerCheckAndRmHelpServices([execServiceName]);

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = inspectTaskInfo.Status.ContainerStatus.ContainerID;
  const nodeId = inspectTaskInfo.NodeID;

  logInfo('dockerCleanServiceItemExecOnTask.TASK_INSPECT', {
    ...logData,
    inspectTaskInfo: maskInspectTaskItem(inspectTaskInfo),
    containerId,
    nodeId,
  });

  //---------
  //EXEC
  //---------
  const dockerExecCommand = `docker exec ${containerId} ${params.execShell} -c '${params.execCommand}'`;
  const logData2 = {
    ...logData,
    containerId,
    nodeId,
    serviceName: execServiceName,
    dockerExecCommand,
  };
  logInfo('dockerCleanServiceItemExecOnTask.exec.SERVICE_CREATE', logData2);
  await dockerApiServiceCreate({
    detach: true,
    name: execServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${nodeId}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: '/bin/sh',
    execCommand: dockerExecCommand,
    logDriver: 'json-file',
  });
  logInfo('dockerCleanServiceItemExecOnTask.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(execServiceName, getProcessEnv().SWARM_UTILS_CLEAN_SERVICE_EXEC_TIMEOUT);
  logInfo('dockerCleanServiceItemExecOnTask.exec.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(execServiceName);
  logInfo('dockerCleanServiceItemExecOnTask.exec.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
}
