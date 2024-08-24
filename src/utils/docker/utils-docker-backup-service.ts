import { getProcessEnv } from '../utils-env-config';
import { lockGetTimeoutBackupService, lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import {
  nameBackupServiceExec,
  nameBackupServiceScaleDown,
  nameBackupServiceScaleUp,
  nameBackupServiceTarUpload,
  nameLock,
} from '../utils-names';
import { authIsS3Enable } from '../utils-token';
import { dockerCheckAndRmHelpServicesForService, dockerWaitForServiceComplete } from './utils-docker';
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
import { dockerLogInspectServiceItem, dockerLogInspectTaskItem } from './utils-docker-logs';

export async function dockerBackupServiceList(serviceList: DockerApiServiceLsItem[]) {
  for (const serviceItem of serviceList) {
    logInfo('dockerBackupServiceList.serviceItem.INIT', {
      serviceItem,
    });

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

    const lockTimeoutObj = lockGetTimeoutBackupService({
      execTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT * taskList.length,
      stopTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT * taskList.length,
      volumeListUploadTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT * taskList.length,
      startTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT * taskList.length,
    });
    const lockKey = nameLock(serviceItem.Name);

    const logData = {
      lockKey,
      lockTimeoutObj,
      serviceItem,
      inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
      taskList,
    };

    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerBackupServiceList.serviceItem.lock.OK', logData);
          await dockerBackupServiceItem(serviceItem, inspectServiceInfo!, taskList!);
          logInfo('dockerBackupServiceList.serviceItem.OK', logData);
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerBackupServiceList.serviceItem.ERR', err, logData);
      });
  }
}

async function dockerBackupServiceItem(
  serviceItem: DockerApiServiceLsItem,
  inspectServiceInfo: DockerApiInspectServiceItem,
  taskList: DockerApiServicePsItem[]
) {
  const logData = {
    serviceItem,
    inspectServiceInfo: dockerLogInspectServiceItem(inspectServiceInfo),
  };
  logInfo('dockerBackupServiceItem.INIT', logData);

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(serviceItem.Name);

  //---------
  //PREPARE-ZONE
  //---------

  // Replicas: '1/1'
  const isReplicated = serviceItem.Mode === 'replicated';
  const currentDesiredReplicas = isReplicated ? Number(serviceItem.Replicas.split('/')[1]) : null;

  // NodeId=volume1,volume2,volume3,...
  const nodeVolumeListMap = new Map<string, Set<string>>();

  //volume-list-upload, collect
  const volumeListUploadLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.volume-list-upload' && el[1].length > 0;
  });
  logInfo('dockerBackupServiceItem.prepareZone.volumeList.INIT', {
    ...logData,
    volumeListLabelObj: volumeListUploadLabelObj,
  });
  if (volumeListUploadLabelObj) {
    const volumeList = volumeListUploadLabelObj[1].split(',');
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
  logInfo('dockerBackupServiceItem.prepareZone.OK', {
    ...logData,
    isReplicated,
    currentDesiredReplicas,
    nodeVolumeListMap: [...nodeVolumeListMap.entries()],
  });

  //---------
  // EXEC
  //---------
  const execLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.exec' && el[1].length > 0;
  });
  logInfo('dockerBackupServiceItem.exec.execLabelObj.INIT', {
    ...logData,
    execLabelObj,
  });
  if (execLabelObj) {
    for (const taskItem of taskList) {
      const logData2 = {
        ...logData,
        execLabelObj,
        taskItem,
      };
      try {
        logInfo('dockerBackupServiceItem.taskItem.exec.INIT', logData2);
        // Проверка и удаление всех сервисов + ThrowError
        await dockerCheckAndRmHelpServicesForService(serviceItem.Name);
        // Непосредственно EXEC
        await dockerBackupServiceExec(serviceItem, taskItem, execLabelObj[1]);
        logInfo('dockerBackupServiceItem.taskItem.exec.OK', logData2);
      } catch (err) {
        logError('dockerBackupServiceItem.taskItem.exec.ERR', err, logData2);
      }
    }
  }

  //---------
  // STOP
  //---------
  const stopLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.stop' && el[1] === 'true';
  });
  logInfo('dockerBackupServiceItem.stop.stopLabelObj.INIT', {
    ...logData,
    isReplicated,
    stopLabelObj,
  });
  if (isReplicated && stopLabelObj) {
    const logData2 = {
      ...logData,
      isReplicated,
      stopLabelObj,
    };
    try {
      logInfo('dockerBackupServiceItem.stop.INIT', logData2);
      // Проверка и удаление всех сервисов + ThrowError
      await dockerCheckAndRmHelpServicesForService(serviceItem.Name);
      // Непосредственно STOP
      await dockerBackupServiceStop(serviceItem);
      logInfo('dockerBackupServiceItem.stop.OK', logData2);
    } catch (err) {
      logError('dockerBackupServiceItem.stop.ERR', err, logData2);
    }
  }

  //---------
  // UPLOAD
  //---------
  if (nodeVolumeListMap.size > 0 && authIsS3Enable()) {
    for (const [nodeId, volumeSet] of [...nodeVolumeListMap.entries()]) {
      const logData2 = {
        ...logData,
        nodeId,
        volumeList: [...volumeSet],
      };
      try {
        logInfo('dockerBackupServiceItem.nodeId.upload.INIT', logData2);
        // Проверка и удаление всех сервисов + ThrowError
        await dockerCheckAndRmHelpServicesForService(serviceItem.Name);
        // Непосредственно UPLOAD
        await dockerBackupServiceUploadVolumeList(serviceItem, nodeId, [...volumeSet]);
        logInfo('dockerBackupServiceItem.nodeId.upload.OK', logData2);
      } catch (err) {
        logError('dockerBackupServiceItem.nodeId.upload.ERR', err, logData2);
      }
    }
  }

  //---------
  // START (Only IF STOP)
  //---------
  if (isReplicated && stopLabelObj && currentDesiredReplicas !== null) {
    const logData2 = {
      ...logData,
      isReplicated,
      stopLabelObj,
      currentDesiredReplicas,
    };
    try {
      logInfo('dockerBackupServiceItem.start.INIT', logData2);
      // Проверка и удаление всех сервисов + ThrowError
      await dockerCheckAndRmHelpServicesForService(serviceItem.Name);
      // Непосредственно START
      await dockerBackupServiceStart(serviceItem, currentDesiredReplicas);
      logInfo('dockerBackupServiceItem.start.OK', logData2);
    } catch (err) {
      logError('dockerBackupServiceItem.start.ERR', err, logData2);
    }
  }
}

async function dockerBackupServiceExec(
  serviceItem: DockerApiServiceLsItem,
  taskItem: DockerApiServicePsItem,
  execCommand: string
) {
  const logData = {
    serviceItem,
    taskItem,
    execCommand,
  };
  logInfo('dockerBackupServiceExec.INIT', logData);

  const taskInspectInfo = await dockerApiInspectTask(taskItem.ID);
  if (!taskInspectInfo) {
    logWarn('dockerbackupServiceExec.taskInspect.NULL', {
      serviceItem,
      taskItem,
    });
    return;
  }

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = taskInspectInfo.Status.ContainerStatus.ContainerID;
  const nodeId = taskInspectInfo.NodeID;

  logInfo('dockerBackupServiceExec.TASK_INSPECT', {
    ...logData,
    taskInspectInfo: dockerLogInspectTaskItem(taskInspectInfo),
    containerId,
    nodeId,
  });

  //---------
  //EXEC
  //---------
  const execServiceName = nameBackupServiceExec(serviceItem.Name);
  const dockerExecShell = getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_SHELL;
  const dockerExecCommand = `docker exec ${containerId} ${dockerExecShell} -c '${execCommand}'`;
  const logData2 = {
    ...logData,
    containerId,
    nodeId,
    serviceName: execServiceName,
    dockerExecCommand,
  };
  logInfo('dockerBackupServiceExec.exec.SERVICE_CREATE', logData2);
  await dockerApiServiceCreate({
    detach: true,
    name: execServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${nodeId}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execShell: 'sh',
    execCommand: dockerExecCommand,
  });
  logInfo('dockerBackupServiceExec.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(execServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT);
  logInfo('dockerBackupServiceExec.exec.OK', logData2);
}

async function dockerBackupServiceStop(serviceItem: DockerApiServiceLsItem) {
  const logData = {
    serviceItem,
  };
  logInfo('dockerBackupServiceStop.INIT', logData);

  const scaleDownCmd = dockerApiServiceScaleCmd(serviceItem.Name, 0);

  //---------
  //SCALE_DOWN
  //---------
  const scaleDownServiceName = nameBackupServiceScaleDown(serviceItem.Name);
  const logData2 = {
    ...logData,
    scaleDownCmd,
    serviceName: scaleDownServiceName,
  };
  logInfo('dockerBackupServiceStop.scaleDown.SERVICE_CREATE', logData2);
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
  logInfo('dockerBackupServiceStop.scaleDown.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleDownServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT);
  logInfo('dockerBackupServiceStop.scaleDown.OK', logData2);
}

async function dockerBackupServiceUploadVolumeList(
  serviceItem: DockerApiServiceLsItem,
  nodeId: string,
  volumeList: string[]
) {
  const logData = {
    serviceItem,
    nodeId,
    volumeList,
  };
  logInfo('dockerBackupServiceUploadVolumeList.INIT', logData);

  const envList = [
    `BACKUP_CRON_EXPRESSION="0 0 5 31 2 ?"`,
    `BACKUP_RETENTION_DAYS=${getProcessEnv().SWARM_UTILS_S3_BACKUP_RETENTION_DAYS}`,
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

  //---------
  //UPLOAD
  //---------
  const uploadServiceName = nameBackupServiceTarUpload(serviceItem.Name);
  const logData2 = {
    ...logData,
    uploadServiceName,
    mappedVolumeList,
  };
  logInfo('dockerBackupServiceUploadVolumeList.upload.SERVICE_CREATE', logData2);
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
  logInfo('dockerBackupServiceUploadVolumeList.upload.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    uploadServiceName,
    getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT
  );
  logInfo('dockerBackupServiceUploadVolumeList.upload.OK', logData2);
}

async function dockerBackupServiceStart(serviceItem: DockerApiServiceLsItem, replicasCount: number) {
  const logData = {
    serviceItem,
    replicasCount,
  };
  logInfo('dockerBackupServiceStart.INIT', logData);

  const scaleUpCmd = dockerApiServiceScaleCmd(serviceItem.Name, replicasCount);

  //---------
  //SCALE_UP
  //---------
  const scaleUpServiceName = nameBackupServiceScaleUp(serviceItem.Name);
  const logData2 = {
    ...logData,
    scaleUpCmd,
    serviceName: scaleUpServiceName,
  };
  logInfo('dockerBackupServiceStart.scaleUp.SERVICE_CREATE', logData2);
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
  logInfo('dockerBackupServiceStart.scaleUp.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleUpServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT);
  logInfo('dockerBackupServiceStart.scaleUp.OK', logData2);
}
