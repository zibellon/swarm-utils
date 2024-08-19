import { dockerServiceGetStatusInfo } from 'src/utils/docker/utils-docker';
import {
  dockerApiInspectService,
  dockerApiInspectTask,
  dockerApiServiceCreate,
  dockerApiServiceLs,
  DockerApiServiceLsItem,
  dockerApiServicePs,
  DockerApiServicePsItem,
  dockerApiServiceRemove,
} from 'src/utils/docker/utils-docker-api';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockResource } from 'src/utils/utils-lock';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import { nameCleanServiceExec, nameGetAllServiceNamesForService, nameLock } from 'src/utils/utils-names';

export async function cronCleanServiceList(dateCron: Date) {
  logInfo('cronCleanServiceList.INIT', {
    dateCron,
  });

  // Очистка Service
  const serviceList = await dockerApiServiceLs([
    {
      key: 'label',
      value: 'swarm-utils.clean.enable=true',
    },
  ]);
  for (const service of serviceList) {
    await cronCleanServiceItem(service, dateCron);
  }
}

async function cronCleanServiceItem(serviceItem: DockerApiServiceLsItem, dateCron: Date) {
  logInfo('cronCleanServiceItem.INIT', {
    serviceItem,
    dateCron,
  });

  const lockKey = nameLock(serviceItem.Name);
  await lockResource
    .acquire(lockKey, async () => {
      const allServiceNameList = nameGetAllServiceNamesForService(serviceItem.Name);

      let canContinue = true;
      const removeServiceNameList: string[] = [];

      for (const serviceName of allServiceNameList) {
        const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);
        if (serviceStatusInfo.isExist) {
          if (serviceStatusInfo.canRemove) {
            // Сервис существует и его МОЖНО удалить
            removeServiceNameList.push(serviceName);
          } else {
            canContinue = false;
          }
        }
      }

      if (canContinue === false) {
        logWarn('cronCleanServiceItem.CANNOT_CONTINUE_1', {
          serviceItem,
          dateCron,
        });
        return;
      }

      if (removeServiceNameList.length > 0) {
        for (const serviceName of removeServiceNameList) {
          await dockerApiServiceRemove(serviceName);
        }
      }

      const inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
      if (inspectServiceInfo === null) {
        logWarn('cronCleanServiceItem.inspectServiceInfo.NULL', {
          serviceItem,
          dateCron,
        });
        return;
      }

      // 'traefik.http.routers.router-test-back-dev-http.entryPoints': 'web';
      // Поиск label - где такой ключ и есть значение
      const execLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
        return el[0] === 'swarm-utils.clean.exec' && el[1].length > 0;
      });
      if (!execLabelObj) {
        logWarn('cronCleanServiceItem.execLabelObj.NULL', {
          serviceItem,
          dateCron,
        });
        return;
      }

      // Получить список всех TASK для этого service
      const taskList = await dockerApiServicePs(serviceItem.Name);
      for (const taskItem of taskList) {
        await cronCleanServiceItemExecOnTask(serviceItem, taskItem, execLabelObj[1], dateCron);
      }
    })
    .catch((err) => {
      logError('cronCleanNodeItem.ERR', err, {
        serviceItem,
      });
    });
}

async function cronCleanServiceItemExecOnTask(
  serviceItem: DockerApiServiceLsItem,
  taskItem: DockerApiServicePsItem,
  execCommand: string,
  dateCron: Date
) {
  logInfo('cronCleanServiceItemExecOnTask.INIT', {
    serviceItem,
    taskItem,
    dateCron,
  });

  const taskInspect = await dockerApiInspectTask(taskItem.ID);
  if (!taskInspect) {
    logWarn('cronCleanServiceItemExecOnTask.taskInspect.NULL', {
      serviceItem,
      taskItem,
      dateCron,
    });
    return;
  }

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
    execShell: 'sh',
    execCommand: execCommand, // From label
  });
  // WAIT FOR SERVICE COMPLETE
  // ...
}
