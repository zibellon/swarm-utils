import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { logInfo, logWarn } from '../utils-logger';
import { nameGetAllServiceNamesForNode, nameGetAllServiceNamesForService } from '../utils-names';
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
    isPendingTimeout: false,
  };

  result.isExist = await dockerServiceIsExist(serviceName);
  if (result.isExist) {
    const canRemoveInfo = await dockerServiceCanRemove(serviceName);
    result.canRemove = canRemoveInfo.canRemove;
    result.isPendingTimeout = canRemoveInfo.isPendingTimeout;
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
  let isPendingTimeout = false;
  for (const taskItem of taskList) {
    const logData = {
      serviceName,
      taskItem,
    };
    logInfo('dockerServiceCanRemove.taskItem.INIT', logData);
    if (canRemove === false) {
      logInfo('dockerServiceCanRemove.taskItem.canRemove.FALSE', logData);
      continue;
    }
    const inspectTaskInfo = await dockerApiInspectTask(taskItem.ID);
    if (inspectTaskInfo === null) {
      logInfo('dockerServiceCanRemove.taskItem.inspect.NULL', logData);
      continue;
    }
    logInfo('dockerServiceCanRemove.taskItem.inspect.OK', {
      ...logData,
      inspectTaskInfo: dockerLogInspectTaskItem(inspectTaskInfo),
    });

    // Сервис НЕЛЬЗЯ удалять в двух случаях
    // 1. Есть таска в статусе runnong
    // 2. Есть таска в статусе pending + createdAt > Now() - 30 sec (set in ENV)
    // 2.1 Отдельный указатель, если произошел pendingTimeout

    // "DesiredState": "shutdown" - можно посмотреть и без inspect
    // inspect - нужен только для отлова: вечного pending

    // Есть таска "Status.State": "running" || "DesiredState": "shutdown"
    if (
      inspectTaskInfo.DesiredState.toLocaleLowerCase() !== 'shutdown' ||
      inspectTaskInfo.Status.State.toLowerCase() === 'running'
    ) {
      canRemove = false;
    } else if (inspectTaskInfo.Status.State.toLowerCase() === 'pending') {
      // Есть таска в статусе pending AND createdAt + 30 sec > Now(). (set in ENV)
      const createdAt = new Date(inspectTaskInfo.CreatedAt);
      const now = new Date();
      logInfo('dockerServiceCanRemove.taskItempending.INIT', {
        ...logData,
        createdAt,
        now,
      });
      if (createdAt.getTime() + getProcessEnv().SWARM_UTILS_PENDING_SERVICE_TIMEOUT > now.getTime()) {
        canRemove = false;
      } else {
        isPendingTimeout = true;
      }
    }
  }
  return {
    canRemove,
    isPendingTimeout,
  };
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

  const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);

  // Или не существует или можно удалить
  let isComplete = serviceStatusInfo.isExist === false || serviceStatusInfo.canRemove === true;
  let isPendingTimeout = serviceStatusInfo.canRemove === true && serviceStatusInfo.isPendingTimeout;

  while (currentTime < timeoutTime && isComplete === false && isPendingTimeout === false) {
    logInfo('dockerWaitForServiceComplete.while.PROCESS', logData);

    await new Promise((r) => setTimeout(r, 2000));

    const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);

    logInfo('dockerWaitForServiceComplete.while.serviceStatusInfo.RESULT', {
      ...logData,
      serviceStatusInfo,
    });

    currentTime = new Date().getTime();
    isComplete = serviceStatusInfo.isExist === false || serviceStatusInfo.canRemove === true;
    isPendingTimeout = serviceStatusInfo.canRemove === true && serviceStatusInfo.isPendingTimeout;
  }
  if (isComplete === true) {
    logInfo('dockerWaitForServiceComplete.COMPLETE', logData);
    return;
  }
  if (isPendingTimeout === true) {
    logWarn('dockerWaitForServiceComplete.pending.TIMEOUT_ERROR', logData);
    throwErrorSimple('dockerWaitForServiceComplete.pending.TIMEOUT', logData);
  }
  logWarn('dockerWaitForServiceComplete.TIMEOUT_ERROR', logData);
  throwErrorSimple('dockerWaitForServiceComplete.TIMEOUT', logData);
}

//---------
// Проверка списка сервисов, и результат - можно идти дальше или нет
//---------
export async function dockerCheckAndRmHelpServicesForNode(nodeKey: string) {
  logInfo('dockerCheckAndRmHelpServicesForNode.INIT', {
    nodeKey,
  });
  const serviceNameList = nameGetAllServiceNamesForNode(nodeKey);
  await dockerCheckAndRmHelpServices(serviceNameList);
}

export async function dockerCheckAndRmHelpServicesForService(serviceKey: string) {
  logInfo('dockerCheckAndRmHelpServicesForService.INIT', {
    serviceKey,
  });
  const serviceNameList = nameGetAllServiceNamesForService(serviceKey);
  await dockerCheckAndRmHelpServices(serviceNameList);
}

export async function dockerCheckAndRmHelpServices(serviceNameList: string[]) {
  logInfo('dockerCheckAndRemoveSupportServices.INIT', {
    serviceNameList,
  });

  let canContinue = true;
  const removeServiceNameList: string[] = [];
  for (const serviceName of serviceNameList) {
    const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);

    logInfo('dockerCheckAndRemoveSupportServices.serviceName.PROCESS', {
      serviceNameList,
      serviceName,
      serviceStatusInfo,
    });

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
    logWarn('dockerCheckAndRemoveSupportServices.CANNOT_CONTINUE', {
      serviceNameList,
    });
    throwErrorSimple('dockerCheckAndRemoveSupportServices.CANNOT_CONTINUE_1', {
      serviceNameList,
    });
  }
  if (removeServiceNameList.length > 0) {
    for (const serviceName of removeServiceNameList) {
      await dockerApiServiceRemove(serviceName);
    }
  }
  logInfo('dockerCheckAndRemoveSupportServices.OK', {
    serviceNameList,
  });
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
