import { dockerCheckAndRmHelpServicesForService } from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectServiceItem,
  DockerApiServiceLsItem,
  dockerApiInspectService,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectServiceItem } from 'src/utils/docker/utils-docker-mask';
import { DockerProcessServiceResultItem } from 'src/utils/docker/utils-docker-types';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockGetTimeoutUpdateService, lockResource } from 'src/utils/utils-lock';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import { nameLock } from 'src/utils/utils-names';
import { dockerUpdateServiceItem } from './update-service-item';

type DockerUpdateServiceParams = {
  serviceList: DockerApiServiceLsItem[];
  force: boolean;
  image: string;
};
export async function dockerUpdateServiceList(params: DockerUpdateServiceParams) {
  const resultItemList: DockerProcessServiceResultItem[] = [];

  for (const serviceItem of params.serviceList) {
    logInfo('dockerUpdateServiceList.serviceItem.INIT', {
      params,
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
      logError('dockerUpdateServiceList.serviceItem.dockerApiInspectService.ERR', err, {
        serviceItem,
      });
    }
    if (inspectServiceInfo === null) {
      const messageJson = logWarn('dockerUpdateServiceList.serviceItem.inspectServiceInfo.NULL', {
        serviceItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
      continue;
    }

    const lockTimeoutObj = lockGetTimeoutUpdateService({
      updateTimeout: getProcessEnv().SWARM_UTILS_UPDATE_SERVICE_TIMEOUT,
    });
    const lockKey = nameLock(serviceItem.Name);

    const logData = {
      lockKey,
      lockTimeoutObj,
      params,
      serviceItem,
      inspectServiceInfo: maskInspectServiceItem(inspectServiceInfo),
    };
    logInfo('dockerUpdateServiceList.serviceItem.lock.INIT', logData);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerUpdateServiceList.serviceItem.lock.OK', logData);
          const helpServiceCompleteResult = await dockerUpdateServiceItem({
            serviceItem,
            inspectServiceInfo: inspectServiceInfo!,
            force: params.force,
            image: params.image,
          });
          resultItem.helpServiceCompleteList.push(helpServiceCompleteResult);
          resultItem.isFailed = helpServiceCompleteResult.isFailed;
          resultItemList.push(resultItem);
          logInfo('dockerUpdateServiceList.serviceItem.OK', logData);

          await dockerCheckAndRmHelpServicesForService(serviceItem.Name).catch((err) => {
            logError('dockerUpdateServiceList.serviceItem.dockerCheckAndRmHelpServicesForService.ERR', err, logData);
          });
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
        }
      )
      .catch((err) => {
        const messageJson = logError('dockerUpdateServiceList.serviceItem.ERR', err, logData);
        resultItem.isFailed = true;
        resultItem.messageJson = messageJson;
        resultItemList.push(resultItem);
      });
  }
  logInfo('dockerUpdateServiceList.RESULT_LIST', {
    resultItemList,
  });
  return resultItemList;
}
