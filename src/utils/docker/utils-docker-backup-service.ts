import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logWarn } from '../utils-logger';
import {
  nameBackupServiceExec,
  nameBackupServiceScaleDown,
  nameBackupServiceScaleUp,
  nameBackupServiceTarUpload,
  nameLock,
} from '../utils-names';
import { authIsS3Enable } from '../utils-token';
import { dockerCheckAndRemoveSupportServices, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectService,
  DockerApiInspectServiceItem,
  dockerApiInspectTask,
  DockerApiInspectTaskItem,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  dockerApiServicePs,
  DockerApiServicePsItem,
  dockerApiServiceScaleCmd,
} from './utils-docker-api';

export async function dockerBackupServiceList(serviceList: DockerApiServiceLsItem[]) {
  for (const serviceItem of serviceList) {
    let inspectServiceInfo: DockerApiInspectServiceItem | null = null;
    try {
      inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    } catch (error) {
      logError('dockerBackupServiceList.serviceItem.dockerApiInspectService.ERR', {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      logWarn('dockerBackupServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      continue;
    }

    let taskList: DockerApiServicePsItem[] | null = null;
    try {
      taskList = await dockerApiServicePs(serviceItem.Name, [
        {
          key: 'desired-state',
          value: 'Running', // Только АКТИВНЫЕ таски
        },
      ]);
    } catch (err) {
      logError('dockerBackupServiceList.serviceItem.dockerApiServicePs.ERR', {
        serviceItem,
      });
    }
    if (taskList === null || taskList.length === 0) {
      logWarn('dockerBackupServiceList.serviceItem.taskList.NULL_OR_EMPTY', {
        serviceItem,
      });
      continue;
    }

    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT * taskList.length +
      getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT * taskList.length +
      getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT * taskList.length +
      getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT * taskList.length +
      getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;

    const lockKey = nameLock(serviceItem.Name);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          await dockerBackupServiceItem(serviceItem, inspectServiceInfo, taskList);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerBackupServiceList.serviceItem.ERR', err, {
          serviceItem,
        });
      });
  }
}

async function dockerBackupServiceItem(
  serviceItem: DockerApiServiceLsItem,
  inspectServiceInfo: DockerApiInspectServiceItem,
  taskList: DockerApiServicePsItem[]
) {
  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRemoveSupportServices(serviceItem.Name);

  // Replicas: '1/1'
  const isReplicated = serviceItem.Mode === 'replicated';
  const currentDesiredReplicas = isReplicated ? Number(serviceItem.Replicas.split('/')[1]) : null;

  // NodeId=volume1,volume2,volume3,...
  const nodeVolumeListMap = new Map<string, Set<string>>();

  //---------
  // VOLUME-LIST, COLLECT
  //---------
  const volumeListLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.volume-list' && el[1].length > 0;
  });
  if (volumeListLabelObj) {
    const volumeList = volumeListLabelObj[1].split(',');
    for (const taskItem of taskList) {
      const logData = {
        serviceItem,
        taskItem,
      };
      let taskInspect: DockerApiInspectTaskItem | null = null;
      try {
        taskInspect = await dockerApiInspectTask(taskItem.ID);
      } catch (err) {
        logError('dockerBackupServiceItem.volumeListMap.taskInspect.ERR', err, logData);
      }
      if (!taskInspect) {
        logWarn('dockerBackupServiceItem.volumeListMap.taskInspect.NULL', logData);
        continue;
      }

      let existNodeVolumeListSet = nodeVolumeListMap.get(taskInspect.NodeID);
      if (!existNodeVolumeListSet) {
        existNodeVolumeListSet = new Set<string>();
      }

      for (const volumeFromLabel of volumeList) {
        existNodeVolumeListSet.add(volumeFromLabel);
      }
      nodeVolumeListMap.set(taskInspect.NodeID, existNodeVolumeListSet);
    }
  }

  //---------
  // EXEC
  //---------
  const execLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.exec' && el[1].length > 0;
  });
  if (execLabelObj) {
    for (const taskItem of taskList) {
      try {
        // Проверка и удаление всех сервисов + ThrowError
        await dockerCheckAndRemoveSupportServices(serviceItem.Name);
        // Непосредственно EXEC
        await dockerBackupServiceExec(serviceItem, taskItem, execLabelObj[1]);
      } catch (err) {
        logError('dockerBackupServiceItem.exec.ERR', err, {
          serviceItem,
          taskItem,
        });
      }
    }
  }

  //---------
  // STOP
  //---------
  const stopLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.stop' && el[1] === 'true';
  });
  if (isReplicated && stopLabelObj) {
    try {
      // Проверка и удаление всех сервисов + ThrowError
      await dockerCheckAndRemoveSupportServices(serviceItem.Name);
      // Непосредственно STOP
      await dockerBackupServiceStop(serviceItem);
    } catch (err) {
      logError('dockerBackupServiceItem.stop.ERR', err, {
        serviceItem,
      });
    }
  }

  //---------
  // UPLOAD
  //---------
  if (nodeVolumeListMap.size > 0 && authIsS3Enable()) {
    for (const [nodeId, volumeSet] of [...nodeVolumeListMap.entries()]) {
      try {
        // Проверка и удаление всех сервисов + ThrowError
        await dockerCheckAndRemoveSupportServices(serviceItem.Name);
        // Непосредственно UPLOAD
        await dockerBackupServiceUploadVolumeList(serviceItem, nodeId, [...volumeSet]);
      } catch (err) {
        logError('dockerBackupServiceItem.upload.ERR', err, {
          serviceItem,
        });
      }
    }
  }

  //---------
  // START (Only IF STOP)
  //---------
  if (isReplicated && stopLabelObj && currentDesiredReplicas !== null) {
    try {
      // Проверка и удаление всех сервисов + ThrowError
      await dockerCheckAndRemoveSupportServices(serviceItem.Name);
      // Непосредственно START
      await dockerBackupServiceStart(serviceItem, currentDesiredReplicas);
    } catch (err) {
      logError('dockerBackupServiceItem.start.ERR', err, {
        serviceItem,
      });
    }
  }
}

async function dockerBackupServiceExec(
  serviceItem: DockerApiServiceLsItem,
  taskItem: DockerApiServicePsItem,
  execCommand: string
) {
  const taskInspect = await dockerApiInspectTask(taskItem.ID);
  if (!taskInspect) {
    logWarn('dockerbackupServiceExec.taskInspect.NULL', {
      serviceItem,
      taskItem,
    });
    return;
  }

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = taskInspect.Status.ContainerStatus.ContainerID;

  //---------
  //EXEC
  //---------
  const execServiceName = nameBackupServiceExec(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: execServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${taskInspect.NodeID}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: `docker exec ${containerId} /bin/sh -c '${execCommand}'`, // From label
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(execServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT);
}

async function dockerBackupServiceStop(serviceItem: DockerApiServiceLsItem) {
  const scaleDownCmd = dockerApiServiceScaleCmd(serviceItem.Name, 0);
  //---------
  //SCALE_DOWN
  //---------
  const scaleDownServiceName = nameBackupServiceScaleDown(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: scaleDownServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.role==manager`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: scaleDownCmd,
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleDownServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT);
}

async function dockerBackupServiceUploadVolumeList(
  serviceItem: DockerApiServiceLsItem,
  nodeId: string,
  volumeList: string[]
) {
  const envList: string[] = [
    `BACKUP_CRON_EXPRESSION="0 0 5 31 2 ?"`,
    `BACKUP_RETENTION_DAYS=5`,
    `BACKUP_COMPRESSION=gz`,
    `BACKUP_FILENAME=backup-${nodeId}-${serviceItem.Name}-%Y-%m-%dT%H-%M-%S.tar.gz`,
    `AWS_ENDPOINT=${getProcessEnv().SWARM_UTILS_S3_DOMAIN}`,
    `AWS_S3_BUCKET_NAME=${getProcessEnv().SWARM_UTILS_S3_BUCKET_NAME}`,
    `AWS_ACCESS_KEY_ID=${getProcessEnv().SWARM_UTILS_S3_ACCESS_KEY}`,
    `AWS_SECRET_ACCESS_KEY=${getProcessEnv().SWARM_UTILS_S3_SECRET_ACCESS_KEY}`,
  ];

  const mappedVolumeList = volumeList.map((volumeName) => {
    return `type=volume,source=${volumeName},target=/backup/${volumeName}`; // type=volume,source=$volumeName,target=/backup/$volumeName
  });

  const uploadServiceName = nameBackupServiceTarUpload(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: uploadServiceName,
    image: 'offen/docker-volume-backup:v2.43.0',
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${nodeId}`,
    'restart-condition': 'none',
    envList: envList,
    mountList: mappedVolumeList,
    execCommand: 'backup && exit', // offen/docker-volume-backup:v2.43.0 -c 'backup && exit'
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    uploadServiceName,
    getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT
  );
}

async function dockerBackupServiceStart(serviceItem: DockerApiServiceLsItem, replicasCount: number) {
  const scaleUpCmd = dockerApiServiceScaleCmd(serviceItem.Name, replicasCount);
  //---------
  //SCALE_UP
  //---------
  const scaleUpServiceName = nameBackupServiceScaleUp(serviceItem.Name);
  await dockerApiServiceCreate({
    detach: true,
    name: scaleUpServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.role==manager`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: scaleUpCmd,
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleUpServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT);
}
