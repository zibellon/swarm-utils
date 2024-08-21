import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logWarn } from '../utils-logger';
import { nameLock, nameUpdateService } from '../utils-names';
import { dockerCheckAndRemoveSupportServices, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServiceUpdateCmd,
} from './utils-docker-api';

type DockerUpdateServiceParams = {
  registryAuth: boolean;
  image?: string;
};
export async function dockerUpdateServiceList(
  serviceList: DockerApiServiceLsItem[],
  params: DockerUpdateServiceParams
) {
  for (const serviceItem of serviceList) {
    const inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    if (inspectServiceInfo === null) {
      logWarn('dockerUpdateServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;

    const lockKey = nameLock(serviceItem.Name);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          await dockerUpdateServiceItem(serviceItem, params);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerUpdateServiceList.serviceItem.ERR', err, {
          serviceItem,
        });
      });
  }
}

async function dockerUpdateServiceItem(serviceItem: DockerApiServiceLsItem, params: DockerUpdateServiceParams) {
  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRemoveSupportServices(serviceItem.Name);

  // Генерация команды для обновления сервиса
  const execCommand = dockerApiServiceUpdateCmd(serviceItem.Name, {
    image: params.image,
    registryAuth: params.registryAuth,
  });

  //---------
  //EXEC
  //---------
  const updateServiceServiceName = nameUpdateService(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: updateServiceServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.role==manager`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execCommand: execCommand,
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(updateServiceServiceName, getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT);
}
