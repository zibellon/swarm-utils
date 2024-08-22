import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { nameLock, nameUpdateService } from '../utils-names';
import { dockerCheckAndRemoveSupportServices, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  DockerApiInspectServiceItem,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServiceUpdateCmd,
} from './utils-docker-api';
import { dockerLogInspectServiceItem } from './utils-docker-logs';

type DockerUpdateServiceParams = {
  registryAuth: boolean;
  image?: string;
};
export async function dockerUpdateServiceList(
  serviceList: DockerApiServiceLsItem[],
  params: DockerUpdateServiceParams
) {
  for (const serviceItem of serviceList) {
    logInfo('dockerUpdateServiceList.serviceItem.INIT', {
      params,
      serviceItem,
    });

    let inspectServiceInfo: DockerApiInspectServiceItem | null = null;
    try {
      inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    } catch (err) {
      logError('dockerUpdateServiceList.serviceItem.dockerApiInspectService.ERR', {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      logWarn('dockerUpdateServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    // TODO - отдельная функция
    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
    const lockKey = nameLock(serviceItem.Name);

    const logData = {
      lockKey,
      maxExecutionTime,
      maxOccupationTime,
      params,
      serviceItem,
      inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
    };

    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerUpdateServiceList.serviceItem.lock.OK', logData);
          await dockerUpdateServiceItem(serviceItem, inspectServiceInfo, params);
          logInfo('dockerUpdateServiceList.serviceItem.OK', logData);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerUpdateServiceList.serviceItem.ERR', err, logData);
      });
  }
}

async function dockerUpdateServiceItem(
  serviceItem: DockerApiServiceLsItem,
  inspectServiceInfo: DockerApiInspectServiceItem,
  params: DockerUpdateServiceParams
) {
  const logData = {
    params,
    serviceItem,
    inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
  };
  logInfo('dockerUpdateServiceItem.INIT', logData);

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRemoveSupportServices(serviceItem.Name);

  // Генерация команды для обновления сервиса
  const execCommand = dockerApiServiceUpdateCmd(serviceItem.Name, {
    image: params.image,
    registryAuth: params.registryAuth,
  });

  logInfo('dockerUpdateServiceItem.EXEC_COMMAND', {
    ...logData,
    execCommand,
  });

  //---------
  //EXEC
  //---------
  const updateServiceServiceName = nameUpdateService(serviceItem.Name);
  const logData2 = {
    ...logData,
    execCommand,
    serviceName: updateServiceServiceName,
  };
  logInfo('dockerUpdateServiceItem.exec.SERVICE_CREATE', logData2);
  await dockerApiServiceCreate({
    detach: true,
    name: updateServiceServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.role==manager`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: execCommand,
  });
  logInfo('dockerUpdateServiceItem.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(updateServiceServiceName, getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT);
  logInfo('dockerUpdateServiceItem.exec.OK', logData2);
}
