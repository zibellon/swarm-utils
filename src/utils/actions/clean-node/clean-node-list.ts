import { dockerCheckAndRmHelpServicesForNode } from 'src/utils/docker/utils-docker';
import { DockerApiInspectNodeItem, DockerApiNodeLsItem, dockerApiInspectNode } from 'src/utils/docker/utils-docker-api';
import { maskInspectNodeItem } from 'src/utils/docker/utils-docker-mask';
import { DockerProcessNodeResultItem } from 'src/utils/docker/utils-docker-types';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockGetTimeoutCleanNode, lockResource } from 'src/utils/utils-lock';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import { nameLock } from 'src/utils/utils-names';
import { dockerCleanNodeItem } from './clean-node-item';

type DockerCleanNodeListParams = {
  nodeList: DockerApiNodeLsItem[];
};
export async function dockerCleanNodeList(params: DockerCleanNodeListParams) {
  const resultItemList: DockerProcessNodeResultItem[] = [];

  for (const nodeItem of params.nodeList) {
    logInfo('dockerCleanNodeList.nodeItem.INIT', {
      nodeItem,
    });

    const resultItem: DockerProcessNodeResultItem = {
      isFailed: false,
      nodeId: nodeItem.ID,
      nodeName: nodeItem.Hostname,
      helpServiceCompleteList: [],
    };

    // Потом пригодится - для получения списка labels
    let nodeInspectInfo: DockerApiInspectNodeItem | null = null;
    try {
      nodeInspectInfo = await dockerApiInspectNode(nodeItem.ID);
    } catch (err) {
      logError('dockerCleanNodeList.nodeItem.dockerApiInspectNode.ERR', err, {
        nodeItem,
      });
    }
    if (nodeInspectInfo === null) {
      const messageJson = logWarn('dockerCleanNodeList.nodeItem.nodeInspectInfo.NULL', {
        nodeItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
      continue;
    }

    // Проверка, что NODE вообще ДОСТУПНА
    if (nodeItem.Status !== 'Ready') {
      const messageJson = logWarn('dockerCleanNodeList.nodeItem.Status.INCORRECT', {
        nodeItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
      continue;
    }
    if (nodeItem.Availability !== 'Active') {
      const messageJson = logWarn('dockerCleanNodeList.nodeItem.Availability.INCORRECT', {
        nodeItem,
      });
      resultItem.isFailed = true;
      resultItem.messageJson = messageJson;
      resultItemList.push(resultItem);
      continue;
    }

    const lockTimeoutObj = lockGetTimeoutCleanNode({
      imageTimeout: getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT,
      builderTimeout: getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT,
      containerTimeout: getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT,
    });
    const lockKey = nameLock(nodeItem.ID);

    const logData = {
      lockKey,
      lockTimeoutObj,
      nodeItem,
      nodeInspectInfo: maskInspectNodeItem(nodeInspectInfo),
    };
    logInfo('dockerCleanNodeList.nodeItem.lock.INIT', logData);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerCleanNodeList.nodeItem.lock.OK', logData);
          const helpServiceCompleteResultList = await dockerCleanNodeItem({
            nodeItem,
            nodeInspectInfo: nodeInspectInfo!,
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
          logInfo('dockerCleanNodeList.nodeItem.OK', logData);

          await dockerCheckAndRmHelpServicesForNode(nodeItem.ID).catch((err) => {
            logError('dockerCleanNodeList.nodeItem.dockerCheckAndRmHelpServicesForNode.ERR', err, logData);
          });
        },
        {
          maxExecutionTime: lockTimeoutObj.maxExecutionTime,
          maxOccupationTime: lockTimeoutObj.maxOccupationTime,
        }
      )
      .catch((err) => {
        const messageJson = logError('dockerCleanNodeList.nodeItem.acquire.ERR', err, logData);
        resultItem.isFailed = true;
        resultItem.messageJson = messageJson;
        resultItemList.push(resultItem);
      });
  }
  logInfo('dockerCleanNodeList.RESULT_LIST', {
    resultItemList,
  });
  return resultItemList;
}
