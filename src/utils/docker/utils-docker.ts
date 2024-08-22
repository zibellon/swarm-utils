import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { logInfo, logWarn } from '../utils-logger';
import { nameGetAllServiceNamesForService } from '../utils-names';
import {
  dockerApiInspectTask,
  dockerApiServiceLs,
  dockerApiServicePs,
  dockerApiServiceRemove,
} from './utils-docker-api';
import { dockerLogInspectTaskItem } from './utils-docker-logs';

// Получение информации о сервисе
// Запущен или нет
// можно удалять иил нет ? (на основе статуса)
export async function dockerServiceGetStatusInfo(serviceName: string) {
  logInfo('dockerServiceGetStatusInfo.INIT', {
    serviceName,
  });
  const result = {
    isExist: false,
    canRemove: true,
  };

  result.isExist = await dockerServiceIsExist(serviceName);
  if (result.isExist) {
    result.canRemove = await dockerServiceCanRemove(serviceName);
  }
  logInfo('dockerServiceGetStatusInfo.RESULT', {
    serviceName,
    result,
  });
  return result;
}

export async function dockerServiceIsExist(serviceName: string) {
  logInfo('dockerServiceIsExist.INIT', {
    serviceName,
  });
  const serviceList = await dockerApiServiceLs([
    {
      key: 'name',
      value: serviceName,
    },
  ]);
  return serviceList.length > 0;
}

export async function dockerServiceCanRemove(serviceName: string) {
  logInfo('dockerServiceCanRemove.INIT', {
    serviceName,
  });
  const taskList = await dockerApiServicePs(serviceName);

  let canRemove = true;
  for (const taskItem of taskList) {
    logInfo('dockerServiceCanRemove.taskItem.INIT', {
      serviceName,
      taskItem,
    });
    if (canRemove === false) {
      logInfo('dockerServiceCanRemove.taskItem.canRemove.FALSE', {
        serviceName,
        taskItem,
      });
      continue;
    }
    const taskInspectInfo = await dockerApiInspectTask(taskItem.ID);
    if (taskInspectInfo === null) {
      continue;
    }
    logInfo('dockerServiceCanRemove.taskInspectInfo.INIT', {
      serviceName,
      taskItem,
      taskInspectInfo: dockerLogInspectTaskItem(taskInspectInfo),
    });

    // Сервис НЕЛЬЗЯ удалять в двух случаях
    // 1. Есть таска в статусе runnong
    // 2. Есть таска в статусе pending + createdAt > Now() - 30 sec (set in ENV)

    // "DesiredState": "shutdown" - можно посмотреть и без inspect
    // inspect - нужен только для отлова: вечного pending

    // Есть таска в статусе running || "DesiredState": "shutdown"
    if (
      taskInspectInfo.DesiredState.toLocaleLowerCase() !== 'shutdown' ||
      taskInspectInfo.Status.State.toLowerCase() === 'running'
    ) {
      canRemove = false;
    } else if (taskInspectInfo.Status.State.toLowerCase() === 'pending') {
      // Есть таска в статусе pending AND createdAt + 30 sec > Now(). (set in ENV)
      const createdAt = new Date(taskInspectInfo.CreatedAt);
      const now = new Date();
      if (createdAt.getTime() + getProcessEnv().SWARM_UTILS_PENDING_SERVICE_TIMEOUT > now.getTime()) {
        canRemove = false;
      }
    }
  }
  return canRemove;
}

// Метод для ожидания завершения работы сервиса
// WHILE + timeout. timeout - передавать как параметр
export async function dockerWaitForServiceComplete(serviceName: string, timeout: number) {
  const logData = {
    serviceName,
    timeout,
  };

  const timeoutTime = new Date().getTime() + timeout;
  let currentTime = new Date().getTime();

  logInfo('dockerWaitForServiceComplete.INIT', {
    ...logData,
    timeout,
    timeoutTime,
    currentTime,
  });

  let isComplete = false;

  const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);

  // Или не существует или можно удалить
  isComplete = serviceStatusInfo.isExist === false || serviceStatusInfo.canRemove === true;

  while (currentTime < timeoutTime && isComplete === false) {
    logInfo('dockerWaitForServiceComplete.while.PROCESS', logData);

    await new Promise((r) => setTimeout(r, 2000));

    const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);

    logInfo('dockerWaitForServiceComplete.while.serviceStatusInfo.RESULT', {
      ...logData,
      serviceStatusInfo,
    });

    isComplete = serviceStatusInfo.isExist === false || serviceStatusInfo.canRemove === true;
  }

  if (isComplete === true) {
    logInfo('dockerWaitForServiceComplete.COMPLETE', logData);
    return;
  }

  logWarn('dockerWaitForServiceComplete.TIMEOUT_ERROR', logData);

  throwErrorSimple('dockerWaitForServiceComplete.TIMEOUT', logData);
}

// Добавить метод для проверки списка сервисов, удаления и указания - можно идти дальше или нет ?
export async function dockerCheckAndRemoveSupportServices(serviceName: string) {
  logInfo('dockerCheckAndRemoveSupportServices.INIT', {
    serviceName,
  });

  const allServiceNameList = nameGetAllServiceNamesForService(serviceName);

  logInfo('dockerCheckAndRemoveSupportServices.ALL_SERVICE_NAME_LIST', {
    serviceName,
    allServiceNameList,
  });

  let canContinue = true;
  const removeServiceNameList: string[] = [];
  for (const allServiceName of allServiceNameList) {
    const serviceStatusInfo = await dockerServiceGetStatusInfo(allServiceName);

    logInfo('dockerCheckAndRemoveSupportServices.serviceName.PROCESS', {
      serviceName,
      serviceStatusInfo,
      allServiceName,
      allServiceNameList,
    });

    if (serviceStatusInfo.isExist) {
      if (serviceStatusInfo.canRemove) {
        // Сервис существует и его МОЖНО удалить
        removeServiceNameList.push(allServiceName);
      } else {
        canContinue = false;
      }
    }
  }
  if (canContinue === false) {
    logWarn('dockerCheckAndRemoveSupportServices.CANNOT_CONTINUE', {
      serviceName,
    });
    throwErrorSimple('dockerCheckAndRemoveSupportServices.CANNOT_CONTINUE_1', {
      serviceName,
    });
  }
  if (removeServiceNameList.length > 0) {
    for (const serviceName of removeServiceNameList) {
      await dockerApiServiceRemove(serviceName);
    }
  }
}

export function dockerRegistryIsCanAuth() {
  let needAuth = false;
  if (
    getProcessEnv().SWARM_UTILS_REGISTRY_URL.length > 0 &&
    getProcessEnv().SWARM_UTILS_REGISTRY_USER.length > 0 &&
    getProcessEnv().SWARM_UTILS_REGISTRY_PASSWORD.length > 0
  ) {
    needAuth = true;
  }
  return needAuth;
}
