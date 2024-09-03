import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { logInfo, logWarn } from '../utils-logger';
import { nameGetAllServiceNamesForNode, nameGetAllServiceNamesForService } from '../utils-names';
import {
  dockerApiInspectTask,
  dockerApiServiceLogs,
  dockerApiServiceLs,
  dockerApiServicePs,
  dockerApiServiceRemove,
} from './utils-docker-api';
import { maskInspectTaskItem } from './utils-docker-mask';

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
      inspectTaskInfo: maskInspectTaskItem(inspectTaskInfo),
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

// Получение информации о завершенном (Complete) сервисе
export type DockerHelpServiceCompleteRes = {
  isFailed: boolean;
  serviceId: string;
  serviceName: string;
  taskList: DockerHelpServiceCompleteTaskRes[];
};
type DockerHelpServiceCompleteTaskRes = {
  taskId: string;
  taskName: string;
  state: string;
  message: string;
  err?: string;
  logList: string[];
};
export async function dockerHelpServiceCompleteInfo(serviceName: string) {
  logInfo('dockerHelpServiceCompleteInfo.INIT', {
    serviceName,
  });

  const serviceList = await dockerApiServiceLs([
    {
      key: 'name',
      value: serviceName,
    },
  ]);

  const result: DockerHelpServiceCompleteRes = {
    isFailed: false,
    serviceId: serviceList.length > 0 ? serviceList[0].ID : 'nothing',
    serviceName: serviceName,
    taskList: [],
  };

  const taskList = await dockerApiServicePs(serviceName);

  for (const taskItem of taskList) {
    const logData = {
      serviceName,
      taskItem,
    };
    logInfo('dockerHelpServiceCompleteInfo.taskItem.INIT', logData);
    const inspectTaskInfo = await dockerApiInspectTask(taskItem.ID);
    if (inspectTaskInfo === null) {
      logWarn('dockerHelpServiceCompleteInfo.taskItem.inspect.NULL', logData);
      continue;
    }
    logInfo('dockerHelpServiceCompleteInfo.taskItem.inspect.OK', {
      ...logData,
      inspectTaskInfo: maskInspectTaskItem(inspectTaskInfo),
    });

    // Если хоть одна из тасок FAILED -> считаем что весь сервис упал
    if (
      inspectTaskInfo.Status.State === 'failed' ||
      (typeof inspectTaskInfo.Status.Err === 'string' && inspectTaskInfo.Status.Err.length > 0)
    ) {
      result.isFailed = true;
    }

    // Сбор логов с каждой таски
    const taskLogList = await dockerApiServiceLogs(taskItem.ID);

    // Status.State: 'failed',
    // Status.Message: 'started',
    // Status.Err: 'task: non-zero exit (1)',
    result.taskList.push({
      taskId: taskItem.ID,
      taskName: taskItem.Name,
      state: inspectTaskInfo.Status.State,
      message: inspectTaskInfo.Status.Message,
      err: inspectTaskInfo.Status.Err,
      logList: taskLogList,
    });
  }
  return result;
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
