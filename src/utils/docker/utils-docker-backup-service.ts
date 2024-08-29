import { authGetS3Params, AuthGetS3ParamsRes } from '../utils-auth';
import { getProcessEnv } from '../utils-env-config';
import { throwErrorSimple } from '../utils-error';
import { lockGetTimeoutBackupService, lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { MaskItem } from '../utils-mask';
import {
  nameBackupServiceExec,
  nameBackupServiceScaleDown,
  nameBackupServiceScaleUp,
  nameBackupServiceTarUpload,
  nameLock,
} from '../utils-names';
import {
  dockerCheckAndRmHelpServices,
  dockerCheckAndRmHelpServicesForService,
  dockerWaitForServiceComplete,
} from './utils-docker';
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
import { maskInspectServiceItem, maskInspectTaskItem, maskS3Params } from './utils-docker-mask';

export async function dockerBackupServiceList(serviceList: DockerApiServiceLsItem[]) {
  for (const serviceItem of serviceList) {
    logInfo('dockerBackupServiceList.serviceItem.INIT', {
      serviceItem,
    });

    let inspectServiceInfo: DockerApiInspectServiceItem | null = null;
    try {
      inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    } catch (err) {
      logError('dockerBackupServiceList.serviceItem.dockerApiInspectService.ERR', err, {
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
      logError('dockerBackupServiceList.serviceItem.dockerApiServicePs.ERR', err, {
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
      inspectServiceInfo: maskInspectServiceItem(inspectServiceInfo),
      taskList,
    };
    logInfo('dockerBackupServiceList.serviceItem.lock.INIT', logData);
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
    inspectServiceInfo: maskInspectServiceItem(inspectServiceInfo),
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
  const execShellLabelObj = Object.entries(inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.exec.shell' && el[1].length > 0;
  });
  logInfo('dockerBackupServiceItem.exec.execLabelObj.INIT', {
    ...logData,
    execLabelObj,
    execShellLabelObj,
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
        // Непосредственно EXEC
        await dockerBackupServiceExec({
          serviceItem,
          taskItem,
          execCommand: execLabelObj[1],
          execShell: execShellLabelObj ? execShellLabelObj[1] : getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_SHELL,
        });
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
  if (nodeVolumeListMap.size > 0) {
    const s3Params = authGetS3Params(inspectServiceInfo.Spec.Labels, 'swarm-utils.backup.volume-list-upload');
    if (s3Params === null) {
      throwErrorSimple('dockerBackupServiceItem.s3Params.NULL', logData);
    }

    for (const [nodeId, volumeSet] of [...nodeVolumeListMap.entries()]) {
      const logData2 = {
        ...logData,
        nodeId,
        volumeList: [...volumeSet],
        s3Params: maskS3Params(s3Params),
      };
      try {
        logInfo('dockerBackupServiceItem.nodeId.upload.INIT', logData2);
        // Непосредственно UPLOAD
        await dockerBackupServiceUploadVolumeList({
          serviceItem,
          nodeId,
          volumeList: [...volumeSet],
          s3Params,
        });
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
      // Непосредственно START
      await dockerBackupServiceStart(serviceItem, currentDesiredReplicas);
      logInfo('dockerBackupServiceItem.start.OK', logData2);
    } catch (err) {
      logError('dockerBackupServiceItem.start.ERR', err, logData2);
    }
  }
}

type DockerBackupServiceExecParams = {
  serviceItem: DockerApiServiceLsItem;
  taskItem: DockerApiServicePsItem;
  execCommand: string;
  execShell: string;
};
async function dockerBackupServiceExec(params: DockerBackupServiceExecParams) {
  const logData = {
    ...params,
  };
  logInfo('dockerBackupServiceExec.INIT', logData);

  const inspectTaskInfo = await dockerApiInspectTask(params.taskItem.ID);
  if (!inspectTaskInfo) {
    logWarn('dockerbackupServiceExec.taskInspect.NULL', logData);
    return;
  }

  const execServiceName = nameBackupServiceExec(params.serviceItem.Name);
  // Проверка и удаление сервиса + ThrowError
  await dockerCheckAndRmHelpServices([execServiceName]);

  // Получить id контейнера - в котором нужно сделать exec команду
  const containerId = inspectTaskInfo.Status.ContainerStatus.ContainerID;
  const nodeId = inspectTaskInfo.NodeID;

  logInfo('dockerBackupServiceExec.TASK_INSPECT', {
    ...logData,
    inspectTaskInfo: maskInspectTaskItem(inspectTaskInfo),
    containerId,
    nodeId,
  });

  //---------
  //EXEC
  //---------
  const dockerExecCommand = `docker exec ${containerId} ${params.execShell} -c '${params.execCommand}'`;
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
    execShell: '/bin/sh',
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
    execShell: '/bin/sh',
    execCommand: scaleDownCmd,
  });
  logInfo('dockerBackupServiceStop.scaleDown.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleDownServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT);
  logInfo('dockerBackupServiceStop.scaleDown.OK', logData2);
}

type DockerBackupServiceUploadVolumeListParams = {
  serviceItem: DockerApiServiceLsItem;
  nodeId: string;
  volumeList: string[];
  s3Params: AuthGetS3ParamsRes;
};
async function dockerBackupServiceUploadVolumeList(params: DockerBackupServiceUploadVolumeListParams) {
  const logData = {
    serviceItem: params.serviceItem,
    nodeId: params.nodeId,
    volumeList: params.volumeList,
    s3Params: maskS3Params(params.s3Params),
  };
  logInfo('dockerBackupServiceUploadVolumeList.INIT', logData);

  const uploadServiceName = nameBackupServiceTarUpload(params.serviceItem.Name);
  // Проверка и удаление сервиса + ThrowError
  await dockerCheckAndRmHelpServices([uploadServiceName]);

  const envList = [
    `BACKUP_CRON_EXPRESSION="0 0 5 31 2 ?"`,
    `BACKUP_RETENTION_DAYS=${params.s3Params.retentionDays}`,
    `BACKUP_COMPRESSION=gz`,
    `BACKUP_FILENAME=backup-${params.nodeId}-${params.serviceItem.Name}-%Y-%m-%dT%H-%M-%S.tar.gz`,
    `AWS_ENDPOINT=${params.s3Params.url}`,
    `AWS_S3_BUCKET_NAME=${params.s3Params.bucket}`,
    `AWS_ACCESS_KEY_ID=${params.s3Params.accessKey}`,
    `AWS_SECRET_ACCESS_KEY=${params.s3Params.secretKey}`,
  ];
  const maskList: MaskItem[] = [
    {
      str: `AWS_S3_BUCKET_NAME=${params.s3Params.bucket}`,
      val: params.s3Params.bucket,
    },
    {
      str: `AWS_ACCESS_KEY_ID=${params.s3Params.accessKey}`,
      val: params.s3Params.accessKey,
    },
    {
      str: `AWS_SECRET_ACCESS_KEY=${params.s3Params.secretKey}`,
      val: params.s3Params.secretKey,
    },
  ];
  const mappedVolumeList = params.volumeList.map((volumeName) => {
    return `type=volume,source=${volumeName},target=/backup/${volumeName}`; // type=volume,source=$volumeName,target=/backup/$volumeName
  });

  //---------
  //UPLOAD
  //---------
  const logData2 = {
    ...logData,
    uploadServiceName,
    mappedVolumeList,
  };
  logInfo('dockerBackupServiceUploadVolumeList.upload.SERVICE_CREATE', logData2);
  await dockerApiServiceCreate({
    detach: true,
    name: uploadServiceName,
    image: 'ghcr.io/offen/docker-volume-backup:v2.43.0',
    mode: 'replicated',
    replicas: 1,
    constraint: `node.id==${params.nodeId}`,
    'restart-condition': 'none',
    envList: envList,
    mountList: mappedVolumeList,
    entrypoint: '/bin/sh',
    execCommand: '/usr/bin/backup && exit', // offen/docker-volume-backup:v2.43.0 -c 'backup && exit'
    maskList: maskList,
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
    execShell: '/bin/sh',
    execCommand: scaleUpCmd,
  });
  logInfo('dockerBackupServiceStart.scaleUp.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleUpServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT);
  logInfo('dockerBackupServiceStart.scaleUp.OK', logData2);
}
