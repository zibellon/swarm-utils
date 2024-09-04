import {
  dockerCheckAndRmHelpServicesForService,
  dockerHelpServiceCompleteInfo,
  dockerWaitForServiceComplete,
} from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectServiceItem,
  DockerApiServiceLsItem,
  dockerApiLoginCmd,
  dockerApiServiceCreate,
  dockerApiServiceUpdateCmd,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectServiceItem, maskRegistryParams } from 'src/utils/docker/utils-docker-mask';
import { AuthGetRegistryParamsRes, authGetRegistryParams } from 'src/utils/utils-auth';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { throwErrorSimple } from 'src/utils/utils-error';
import { logInfo } from 'src/utils/utils-logger';
import { MaskItem } from 'src/utils/utils-mask';
import { nameUpdateService } from 'src/utils/utils-names';

type DockerUpdateServiceItemParams = {
  serviceItem: DockerApiServiceLsItem;
  inspectServiceInfo: DockerApiInspectServiceItem;
  force: boolean;
  image: string;
};
export async function dockerUpdateServiceItem(params: DockerUpdateServiceItemParams) {
  const logData = {
    ...params,
    inspectServiceInfo: maskInspectServiceItem(params.inspectServiceInfo),
  };
  logInfo('dockerUpdateServiceItem.INIT', logData);

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(params.serviceItem.Name);

  let registryParams: AuthGetRegistryParamsRes | null = null;

  // Работа с регистри
  const registryAuthLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.update.registry.auth' && el[1].length > 0;
  });
  if (registryAuthLabelObj && registryAuthLabelObj[1] === 'true') {
    registryParams = authGetRegistryParams(params.inspectServiceInfo.Spec.Labels, 'swarm-utils.update');
    if (registryParams === null) {
      throwErrorSimple('dockerUpdateServiceItem.registryAuth.NULL', logData);
    }
    logInfo('dockerUpdateServiceItem.registryAuth.INIT', {
      ...logData,
      registryParams: maskRegistryParams(registryParams),
    });
  }

  // Генерация команды для обновления сервиса
  let execCommand = dockerApiServiceUpdateCmd(params.serviceItem.Name, {
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
  const updateServiceServiceName = nameUpdateService(params.serviceItem.Name);
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
    logDriver: 'json-file',
    maskList: maskList,
  });
  logInfo('dockerUpdateServiceItem.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(updateServiceServiceName, getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT);
  logInfo('dockerUpdateServiceItem.exec.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(updateServiceServiceName);
  logInfo('dockerUpdateServiceItem.exec.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
}
