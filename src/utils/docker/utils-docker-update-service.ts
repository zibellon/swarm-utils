import { authGetRegistryParams, AuthGetRegistryParamsRes } from '../utils-auth';
import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { lockGetTimeoutUpdateService, lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { MaskItem } from '../utils-mask';
import { nameLock, nameUpdateService } from '../utils-names';
import { dockerCheckAndRmHelpServicesForService, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  DockerApiInspectServiceItem,
  dockerApiLoginCmd,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServiceUpdateCmd,
} from './utils-docker-api';
import { maskInspectServiceItem, maskRegistryParams } from './utils-docker-mask';

type DockerUpdateServiceParams = {
  force: boolean;
  image: string;
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
      logError('dockerUpdateServiceList.serviceItem.dockerApiInspectService.ERR', err, {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      logWarn('dockerUpdateServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    const lockTimeoutObj = lockGetTimeoutUpdateService({
      updateTimeout: getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT,
    });
    const lockKey = nameLock(serviceItem.Name);

    const logData = {
      lockKey,
      lockTimeoutObj,
      params,
      serviceItem,
      inspectServiceInfo: maskInspectServiceItem(inspectServiceInfo),
    };
    logInfo('dockerUpdateServiceList.serviceItem.lock.INIT', logData);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerUpdateServiceList.serviceItem.lock.OK', logData);
          await dockerUpdateServiceItem(serviceItem, inspectServiceInfo!, params);
          logInfo('dockerUpdateServiceList.serviceItem.OK', logData);
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
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
    inspectServiceInfo: maskInspectServiceItem(inspectServiceInfo),
  };
  logInfo('dockerUpdateServiceItem.INIT', logData);

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(serviceItem.Name);

  let registryParams: AuthGetRegistryParamsRes | null = null;

  // Работа с регистри
  const registryAuthLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.update.registry.auth' && el[1].length > 0;
  });
  if (registryAuthLabelObj && registryAuthLabelObj[1] === 'true') {
    registryParams = authGetRegistryParams(inspectServiceInfo.Spec.Labels, 'swarm-utils.update');
    if (registryParams === null) {
      throwErrorSimple('dockerUpdateServiceItem.registryAuth.NULL', logData);
    }
    logInfo('dockerUpdateServiceItem.registryAuth.INIT', {
      ...logData,
      registryParams: maskRegistryParams(registryParams),
    });
  }

  // Генерация команды для обновления сервиса
  let execCommand = dockerApiServiceUpdateCmd(serviceItem.Name, {
    image: params.image,
    registryAuth: registryParams !== null,
    force: params.force,
  });

  let maskList: MaskItem[] | undefined = undefined;

  // Если нужна авторизация - она должна делать внутри контейнера
  if (registryParams !== null) {
    const registryAuthCmd = dockerApiLoginCmd(registryParams);
    execCommand = registryAuthCmd + ' && ' + execCommand;
    maskList = [
      {
        str: registryParams.url,
        val: registryParams.url,
      },
      {
        str: `-p ${registryParams.password}`,
        val: registryParams.password,
      },
    ];
  }

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
    execShell: '/bin/sh',
    execCommand: execCommand,
    maskList: maskList,
  });
  logInfo('dockerUpdateServiceItem.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(updateServiceServiceName, getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT);
  logInfo('dockerUpdateServiceItem.exec.OK', logData2);
}
