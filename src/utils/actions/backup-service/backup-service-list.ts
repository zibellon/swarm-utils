import { dockerCheckAndRmHelpServicesForService } from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectServiceItem,
  DockerApiServiceLsItem,
  DockerApiServicePsItem,
  dockerApiInspectService,
  dockerApiServicePs,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectServiceItem } from 'src/utils/docker/utils-docker-mask';
import { DockerProcessServiceResultItem } from 'src/utils/docker/utils-docker-types';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockGetTimeoutBackupService, lockResource } from 'src/utils/utils-lock';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import { nameLock } from 'src/utils/utils-names';
import { dockerBackupServiceItem } from './backup-service-item';

type DockerBackupServiceListParams = {
  serviceList: DockerApiServiceLsItem[];
};
export async function dockerBackupServiceList(params: DockerBackupServiceListParams) {
  const resultItemList: DockerProcessServiceResultItem[] = [];

  for (const serviceItem of params.serviceList) {
    logInfo('dockerBackupServiceList.serviceItem.INIT', {
      serviceItem,
    });

    const resultItem: DockerProcessServiceResultItem = {
      isFailed: false,
      serviceId: serviceItem.ID,
      serviceName: serviceItem.Name,
      helpServiceCompleteList: [],
    };

    let inspectServiceInfo: DockerApiInspectServiceItem | null = null;
    try {
      inspectServiceInfo = await dockerApiInspectService(serviceItem.ID);
    } catch (err) {
      logError('dockerBackupServiceList.serviceItem.dockerApiInspectService.ERR', err, {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      const messageJson = logWarn('dockerBackupServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
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
      const messageJson = logWarn('dockerBackupServiceList.serviceItem.taskList.NULL_OR_EMPTY', {
        serviceItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
      continue;
    }

    const lockTimeoutObj = lockGetTimeoutBackupService({
      execTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_EXEC_TIMEOUT,
      stopTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_STOP_TIMEOUT,
      volumeListUploadTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_VOLUME_LIST_UPLOAD_TIMEOUT,
      startTimeout: getProcessEnv().SWARM_UTILS_BACKUP_SERVICE_START_TIMEOUT,
      taskCount: taskList.length,
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
          const helpServiceCompleteResultList = await dockerBackupServiceItem({
            serviceItem,
            inspectServiceInfo: inspectServiceInfo!,
            taskList: taskList!,
          });
          if (helpServiceCompleteResultList.length > 0) {
            for (const helpService of helpServiceCompleteResultList) {
              if (resultItem.isFailed === false && helpService.isFailed === true) {
                resultItem.isFailed = true;
              }
              resultItem.helpServiceCompleteList.push(helpService);
            }
          } else {
            resultItem.isFailed = true;
            resultItem.messageString = 'helpServiceCompleteResultList.EMPTY';
          }
          resultItemList.push(resultItem);
          logInfo('dockerBackupServiceList.serviceItem.OK', logData);

          await dockerCheckAndRmHelpServicesForService(serviceItem.Name).catch((err) => {
            logError('dockerBackupServiceList.serviceItem.dockerCheckAndRmHelpServicesForService.ERR', err, logData);
          });
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerBackupServiceList.serviceItem.ERR', err, logData);
        const messageJson = logError('dockerBackupServiceList.serviceItem.ERR', err, logData);
        resultItem.isFailed = true;
        resultItem.messageJson = messageJson;
        resultItemList.push(resultItem);
      });
  }
  logInfo('dockerBackupServiceList.RESULT_LIST', {
    resultItemList,
  });
  return resultItemList;
}
