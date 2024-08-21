import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { logInfo, logWarn } from '../utils-logger';
import { dockerApiInspectTask, dockerApiServiceLs, dockerApiServicePs } from './utils-docker-api';

// Получение информации о сервисе
// Запущен или нет
// можно удалять иил нет ? (на основе статуса)
export async function dockerServiceGetStatusInfo(serviceName: string) {
  const result = {
    isExist: false,
    canRemove: true,
  };

  result.isExist = await dockerServiceIsExist(serviceName);
  if (result.isExist) {
    result.canRemove = await dockerServiceCanRemove(serviceName);
  }
  return result;
}

export async function dockerServiceIsExist(serviceName: string) {
  const serviceList = await dockerApiServiceLs([
    {
      key: 'name',
      value: serviceName,
    },
  ]);
  // Сервиса еще нет
  if (serviceList.length === 0) {
    return false;
  }
  return true;
}

export async function dockerServiceCanRemove(serviceName: string) {
  const taskList = await dockerApiServicePs(serviceName);

  let canRemove = true;
  for (const task of taskList) {
    const taskInspect = await dockerApiInspectTask(task.ID);
    if (taskInspect !== null) {
      // Сервис НЕЛЬЗЯ удалять в двух случаях
      // 1. Есть таска в статусе runnong
      // 2. Есть таска в статусе pending + createdAt > Now() - 30 sec (set in ENV)

      // Есть таска в статусе runnong
      if (taskInspect.Status.State.toLowerCase() === 'running') {
        canRemove = false;
      } else if (taskInspect.Status.State.toLowerCase() === 'pending') {
        // Есть таска в статусе pending AND createdAt + 30 sec > Now(). (set in ENV)
        const createdAt = new Date(taskInspect.CreatedAt);
        const now = new Date();
        if (createdAt.getTime() + getProcessEnv().SWARM_UTILS_PENDING_SERVICE_TIMEOUT > now.getTime()) {
          canRemove = false;
        }
      }
    }
  }
  return canRemove;
}

// Можно ли удалить список сервисов
// Если хоть один - нельзя -> ВСЕ НЕЛЬЗЯ
export async function dockerServiceListCanRemove(serviceList: string[]) {
  let canRemove = true;
  for (const serviceName of serviceList) {
    const canRemoveLocal = await dockerServiceCanRemove(serviceName);
    if (canRemoveLocal === false) {
      canRemove = false;
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

  logInfo('dockerWaitForServiceComplete.INIT', logData);

  const timeoutTime = new Date().getTime() + timeout;
  let currentTime = new Date().getTime();

  let isComplete = true;

  const taskList = await dockerApiServicePs(serviceName);
  for (const taskItem of taskList) {
    if (taskItem.DesiredState.toLocaleLowerCase() !== 'shutdown') {
      isComplete = false;
    }
  }

  while (currentTime < timeoutTime && isComplete === false) {
    await new Promise((r) => setTimeout(r, 2000));

    const taskList = await dockerApiServicePs(serviceName);
    for (const taskItem of taskList) {
      if (taskItem.DesiredState.toLocaleLowerCase() !== 'shutdown') {
        isComplete = false;
      }
    }
  }

  if (isComplete === true) {
    logInfo('dockerWaitForServiceComplete.COMPLETE', logData);
    return;
  }

  logWarn('dockerWaitForServiceComplete.TIMEOUT_ERROR', logData);

  throwErrorSimple('dockerWaitForServiceComplete.TIMEOUT', logData);
}

// Добавить метод для проверки списка сервисов, удаления и указания - можно идти дальше или нет ?
// ....

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

const pendingPs = {
  CurrentState: 'Pending 18 seconds ago',
  DesiredState: 'Running',
  Error: '"no suitable node (scheduling …"',
  ID: 'qckvegjyr55g',
  Image: 'docker:25.0.5-cli-alpine3.20',
  Name: 'my_service_1.1',
  Node: '',
  Ports: '',
};
const pendingInspect = [
  {
    ID: 'qckvegjyr55gxmrrwmavbtmlz',
    Version: { Index: 5665 },
    CreatedAt: '2024-08-18T08:13:20.440760627Z',
    UpdatedAt: '2024-08-18T08:13:20.494270989Z',
    Labels: {},
    Spec: {
      ContainerSpec: {
        Image: 'docker:25.0.5-cli-alpine3.20@sha256:9210050a84564f5f2df1dbbe6c0d1b28cd86a784a4b673612a449c6ecb9565f6',
        Args: ['sh', '-c', 'ls -la'],
        Init: false,
        Mounts: [{ Type: 'bind', Source: '/var/run/docker.sock', Target: '/var/run/docker.sock', ReadOnly: true }],
        DNSConfig: {},
        Isolation: 'default',
      },
      Resources: { Limits: {}, Reservations: {} },
      RestartPolicy: { Condition: 'none', Delay: 5000000000, MaxAttempts: 0 },
      ForceUpdate: 0,
    },
    ServiceID: 'vib1k7qngdi44kkp7jxdrgiu7',
    Slot: 1,
    Status: {
      Timestamp: '2024-08-18T08:13:20.494151569Z',
      State: 'pending',
      Message: 'pending task scheduling',
      Err: 'no suitable node (scheduling constraints not satisfied on 12 nodes)',
      PortStatus: {},
    },
    DesiredState: 'running',
    Volumes: null,
  },
];
