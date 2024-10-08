import {
  dockerCheckAndRmHelpServices,
  dockerCheckAndRmHelpServicesForService,
  dockerHelpServiceCompleteInfo,
  DockerHelpServiceCompleteRes,
  dockerWaitForServiceComplete,
} from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectServiceItem,
  dockerApiInspectTask,
  DockerApiInspectTaskItem,
  dockerApiServiceCreate,
  DockerApiServiceLsItem,
  DockerApiServicePsItem,
  dockerApiServiceScaleCmd,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectServiceItem, maskInspectTaskItem, maskS3Params } from 'src/utils/docker/utils-docker-mask';
import { authGetS3Params, AuthGetS3ParamsRes } from 'src/utils/utils-auth';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { throwErrorSimple } from 'src/utils/utils-error';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import { MaskItem } from 'src/utils/utils-mask';
import {
  nameBackupServiceExec,
  nameBackupServiceScaleDown,
  nameBackupServiceScaleUp,
  nameBackupServiceTarUpload,
} from 'src/utils/utils-names';

type DockerBackupServiceItemParams = {
  serviceItem: DockerApiServiceLsItem;
  inspectServiceInfo: DockerApiInspectServiceItem;
  taskList: DockerApiServicePsItem[];
};
export async function dockerBackupServiceItem(params: DockerBackupServiceItemParams) {
  const logData = {
    ...params,
    inspectServiceInfo: maskInspectServiceItem(params.inspectServiceInfo),
  };
  logInfo('dockerBackupServiceItem.INIT', logData);

  // Проверка и удаление всех сервисов + ThrowError
  await dockerCheckAndRmHelpServicesForService(params.serviceItem.Name);

  const helpServiceCompleteResultList: DockerHelpServiceCompleteRes[] = [];

  //---------
  //PREPARE-ZONE
  //---------

  // Replicas: '1/1'
  const isReplicated = params.serviceItem.Mode === 'replicated';
  const currentDesiredReplicas = isReplicated ? Number(params.serviceItem.Replicas.split('/')[1]) : null;

  // NodeId=volume1,volume2,volume3,...
  const nodeVolumeListMap = new Map<string, Set<string>>();

  //volume-list-upload, collect
  const volumeListUploadLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.volume-list-upload' && el[1].length > 0;
  });
  logInfo('dockerBackupServiceItem.prepareZone.volumeList.INIT', {
    ...logData,
    volumeListLabelObj: volumeListUploadLabelObj,
  });
  if (volumeListUploadLabelObj) {
    const volumeList = volumeListUploadLabelObj[1].split(',');
    for (const taskItem of params.taskList) {
      const logData = {
        serviceItem: params.serviceItem,
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
  const execLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.exec' && el[1].length > 0;
  });
  const execShellLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
    return el[0] === 'swarm-utils.backup.exec.shell' && el[1].length > 0;
  });
  logInfo('dockerBackupServiceItem.exec.execLabelObj.INIT', {
    ...logData,
    execLabelObj,
    execShellLabelObj,
  });
  if (execLabelObj) {
    for (const taskItem of params.taskList) {
      const logData2 = {
        ...logData,
        execLabelObj,
        taskItem,
      };
      try {
        logInfo('dockerBackupServiceItem.taskItem.exec.INIT', logData2);
        // Непосредственно EXEC
        const helpServiceCompleteResult = await dockerBackupServiceExec({
          serviceItem: params.serviceItem,
          taskItem,
          execCommand: execLabelObj[1],
          execShell: execShellLabelObj ? execShellLabelObj[1] : getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_SHELL,
        });
        helpServiceCompleteResultList.push(helpServiceCompleteResult);
        logInfo('dockerBackupServiceItem.taskItem.exec.OK', logData2);
      } catch (err) {
        logError('dockerBackupServiceItem.taskItem.exec.ERR', err, logData2);
      }
    }
  }

  //---------
  // STOP
  //---------
  const stopLabelObj = Object.entries(params.inspectServiceInfo.Spec.Labels).find((el) => {
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
      const helpServiceCompleteResult = await dockerBackupServiceStop({
        serviceItem: params.serviceItem,
      });
      helpServiceCompleteResultList.push(helpServiceCompleteResult);
      logInfo('dockerBackupServiceItem.stop.OK', logData2);
    } catch (err) {
      logError('dockerBackupServiceItem.stop.ERR', err, logData2);
    }
  }

  //---------
  // UPLOAD
  //---------
  if (nodeVolumeListMap.size > 0) {
    const s3Params = authGetS3Params(params.inspectServiceInfo.Spec.Labels, 'swarm-utils.backup.volume-list-upload');
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
        const helpServiceCompleteResult = await dockerBackupServiceUploadVolumeList({
          serviceItem: params.serviceItem,
          nodeId,
          volumeList: [...volumeSet],
          s3Params,
        });
        helpServiceCompleteResultList.push(helpServiceCompleteResult);
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
      const helpServiceCompleteResult = await dockerBackupServiceStart({
        serviceItem: params.serviceItem,
        replicasCount: currentDesiredReplicas,
      });
      helpServiceCompleteResultList.push(helpServiceCompleteResult);
      logInfo('dockerBackupServiceItem.start.OK', logData2);
    } catch (err) {
      logError('dockerBackupServiceItem.start.ERR', err, logData2);
    }
  }

  return helpServiceCompleteResultList;
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
    throwErrorSimple('dockerbackupServiceExec.taskInspect.NULL', logData);
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
    logDriver: 'json-file',
  });
  logInfo('dockerBackupServiceExec.exec.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(execServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT);
  logInfo('dockerBackupServiceExec.exec.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(execServiceName);
  logInfo('dockerBackupServiceExec.exec.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
}

type DockerBackupServiceStopParams = {
  serviceItem: DockerApiServiceLsItem;
};
async function dockerBackupServiceStop(params: DockerBackupServiceStopParams) {
  const logData = {
    ...params,
  };
  logInfo('dockerBackupServiceStop.INIT', logData);

  const scaleDownCmd = dockerApiServiceScaleCmd(params.serviceItem.Name, 0);

  //---------
  //SCALE_DOWN
  //---------
  const scaleDownServiceName = nameBackupServiceScaleDown(params.serviceItem.Name);
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
    logDriver: 'json-file',
  });
  logInfo('dockerBackupServiceStop.scaleDown.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleDownServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT);
  logInfo('dockerBackupServiceStop.scaleDown.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(scaleDownServiceName);
  logInfo('dockerBackupServiceStop.scaleDown.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
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
    logDriver: 'json-file',
    maskList: maskList,
  });
  logInfo('dockerBackupServiceUploadVolumeList.upload.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    uploadServiceName,
    getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT
  );
  logInfo('dockerBackupServiceUploadVolumeList.upload.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(uploadServiceName);
  logInfo('dockerBackupServiceUploadVolumeList.upload.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
}

type DockerBackupServiceStartParams = {
  serviceItem: DockerApiServiceLsItem;
  replicasCount: number;
};
async function dockerBackupServiceStart(params: DockerBackupServiceStartParams) {
  const logData = {
    ...params,
  };
  logInfo('dockerBackupServiceStart.INIT', logData);

  const scaleUpCmd = dockerApiServiceScaleCmd(params.serviceItem.Name, params.replicasCount);

  //---------
  //SCALE_UP
  //---------
  const scaleUpServiceName = nameBackupServiceScaleUp(params.serviceItem.Name);
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
    logDriver: 'json-file',
  });
  logInfo('dockerBackupServiceStart.scaleUp.WAIT_FOR_COMPLETE', logData2);
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(scaleUpServiceName, getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT);
  logInfo('dockerBackupServiceStart.scaleUp.OK', logData2);

  const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(scaleUpServiceName);
  logInfo('dockerBackupServiceStart.scaleUp.HELP_SERVICE_COMPLETE_INFO', {
    ...logData2,
    helpServiceCompleteInfo,
  });
  return helpServiceCompleteInfo;
}
