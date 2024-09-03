import { getProcessEnv } from '../utils-env-config';
import { lockGetTimeoutCleanNode, lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { nameCleanNodeBuilder, nameCleanNodeContainers, nameCleanNodeImages, nameLock } from '../utils-names';
import {
  dockerCheckAndRmHelpServicesForNode,
  dockerHelpServiceCompleteInfo,
  DockerHelpServiceCompleteRes,
  dockerWaitForServiceComplete,
} from './utils-docker';
import {
  dockerApiInspectNode,
  DockerApiInspectNodeItem,
  DockerApiNodeLsItem,
  dockerApiServiceCreate,
} from './utils-docker-api';
import { maskInspectNodeItem } from './utils-docker-mask';
import { DockerProcessNodeResultItem } from './utils-docker-types';

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
          const helpServiceCompleteResultList = await dockerCleanNodeItem(nodeItem, nodeInspectInfo!);
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

async function dockerCleanNodeItem(nodeItem: DockerApiNodeLsItem, nodeInspectInfo: DockerApiInspectNodeItem) {
  const logData = {
    nodeItem,
    nodeInspectInfo: maskInspectNodeItem(nodeInspectInfo),
  };
  logInfo('dockerCleanNodeItem.INIT', logData);

  const nodeKey = `${nodeItem.ID}`;

  // Проверка и удаление всех сервисов + throwError
  await dockerCheckAndRmHelpServicesForNode(nodeKey);

  logInfo('dockerCleanNodeItem.PROCESS', logData);

  const helpServiceCompleteResultList: DockerHelpServiceCompleteRes[] = [];

  //---------
  //IMAGE
  //---------
  try {
    const cleanImageServiceName = nameCleanNodeImages(nodeKey);
    const logData2 = {
      ...logData,
      serviceName: cleanImageServiceName,
    };

    logInfo('dockerCleanNodeItem.image.SERVICE_CREATE', logData2);
    await dockerApiServiceCreate({
      detach: true,
      name: cleanImageServiceName,
      image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
      mode: 'replicated',
      replicas: 1,
      constraint: `node.id==${nodeItem.ID}`,
      'restart-condition': 'none',
      mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
      execShell: '/bin/sh',
      execCommand: 'docker image prune -a -f',
      logDriver: 'json-file',
    });
    logInfo('dockerCleanNodeItem.image.WAIT_FOR_COMPLETE', logData2);
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanImageServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT);
    logInfo('dockerCleanNodeItem.image.OK', logData2);

    const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(cleanImageServiceName);
    logInfo('dockerCleanNodeItem.image.HELP_SERVICE_COMPLETE_INFO', {
      ...logData2,
      helpServiceCompleteInfo,
    });
    helpServiceCompleteResultList.push(helpServiceCompleteInfo);
  } catch (err) {
    logError('dockerCleanNodeItem.image.ERR', err, logData);
  }

  //---------
  //BUILDER (cache)
  //---------
  try {
    const cleanBuilderServiceName = nameCleanNodeBuilder(nodeKey);
    const logData2 = {
      ...logData,
      serviceName: cleanBuilderServiceName,
    };

    logInfo('dockerCleanNodeItem.builder.SERVICE_CREATE', logData2);
    await dockerApiServiceCreate({
      detach: true,
      name: cleanBuilderServiceName,
      image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
      mode: 'replicated',
      replicas: 1,
      constraint: `node.id==${nodeItem.ID}`,
      'restart-condition': 'none',
      mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
      execShell: '/bin/sh',
      execCommand: 'docker builder prune -f',
      logDriver: 'json-file',
    });
    logInfo('dockerCleanNodeItem.builder.WAIT_FOR_COMPLETE', logData2);
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanBuilderServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT);
    logInfo('dockerCleanNodeItem.builder.OK', logData2);

    const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(cleanBuilderServiceName);
    logInfo('dockerCleanNodeItem.builder.HELP_SERVICE_COMPLETE_INFO', {
      ...logData2,
      helpServiceCompleteInfo,
    });
    helpServiceCompleteResultList.push(helpServiceCompleteInfo);
  } catch (err) {
    logError('dockerCleanNodeItem.builder.ERR', err, logData);
  }

  //---------
  //CONTAINER (exited, stopped and other status - clean all)
  //---------
  try {
    const cleanContainerServiceName = nameCleanNodeContainers(nodeKey);
    const logData2 = {
      ...logData,
      serviceName: cleanContainerServiceName,
    };
    logInfo('dockerCleanNodeItem.container.SERVICE_CREATE', logData2);
    await dockerApiServiceCreate({
      detach: true,
      name: cleanContainerServiceName,
      image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
      mode: 'replicated',
      replicas: 1,
      constraint: `node.id==${nodeItem.ID}`,
      'restart-condition': 'none',
      mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
      execShell: '/bin/sh',
      execCommand: 'docker container prune -f',
      logDriver: 'json-file',
    });
    logInfo('dockerCleanNodeItem.container.WAIT_FOR_COMPLETE', logData2);
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(
      cleanContainerServiceName,
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
    );
    logInfo('dockerCleanNodeItem.container.OK', logData2);

    const helpServiceCompleteInfo = await dockerHelpServiceCompleteInfo(cleanContainerServiceName);
    logInfo('dockerCleanNodeItem.container.HELP_SERVICE_COMPLETE_INFO', {
      ...logData2,
      helpServiceCompleteInfo,
    });
    helpServiceCompleteResultList.push(helpServiceCompleteInfo);
  } catch (err) {
    logError('dockerCleanNodeItem.container.ERR', err, logData);
  }
  return helpServiceCompleteResultList;
}
