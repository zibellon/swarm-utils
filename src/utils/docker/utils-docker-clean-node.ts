import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import { nameCleanNodeBuilder, nameCleanNodeContainers, nameCleanNodeImages, nameLock } from '../utils-names';
import { dockerCheckAndRemoveSupportServices, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectNode,
  DockerApiInspectNodeItem,
  DockerApiNodeLsItem,
  dockerApiServiceCreate,
} from './utils-docker-api';
import { dockerLogInspectNodeItem } from './utils-docker-logs';

export async function dockerCleanNodeList(nodeList: DockerApiNodeLsItem[]) {
  for (const nodeItem of nodeList) {
    logInfo('dockerCleanNodeList.nodeItem.INIT', {
      nodeItem,
    });

    // Потом пригодится - для получения списка labels
    let nodeInspectInfo: DockerApiInspectNodeItem | null = null;
    try {
      nodeInspectInfo = await dockerApiInspectNode(nodeItem.ID);
    } catch (err) {
      logError('dockerCleanNodeList.nodeItem.dockerApiInspectNode.ERR', {
        nodeItem,
      });
    }
    if (nodeInspectInfo === null) {
      logWarn('dockerCleanNodeList.nodeItem.nodeInspectInfo.NULL', {
        nodeItem,
      });
      continue;
    }

    // Проверка, что NODE вообще ДОСТУПНА
    if (nodeItem.Status !== 'Ready') {
      logWarn('dockerCleanNodeList.nodeItem.Status.INCORRECT', {
        nodeItem,
      });
      continue;
    }
    if (nodeItem.Availability !== 'Active') {
      logWarn('dockerCleanNodeList.nodeItem.Availability.INCORRECT', {
        nodeItem,
      });
      continue;
    }

    // TODO - вынести в отдельную функцию
    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
    const lockKey = nameLock(nodeItem.ID);

    const logData = {
      lockKey,
      maxExecutionTime,
      maxOccupationTime,
      nodeItem,
      nodeInspectInfo: dockerLogInspectNodeItem(nodeInspectInfo),
    };
    await lockResource
      .acquire(
        lockKey,
        async () => {
          logInfo('dockerCleanNodeList.nodeItem.lock.OK', logData);
          await dockerCleanNodeItem(nodeItem, nodeInspectInfo);
          logInfo('dockerCleanNodeList.nodeItem.OK', logData);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerCleanNodeList.nodeItem.acquire.ERR', err, logData);
      });
  }
}

async function dockerCleanNodeItem(nodeItem: DockerApiNodeLsItem, nodeInspectInfo: DockerApiInspectNodeItem) {
  const logData = {
    nodeItem,
    nodeInspectInfo: dockerLogInspectNodeItem(nodeInspectInfo),
  };
  logInfo('dockerCleanNodeItem.INIT', logData);

  const nodeKey = `${nodeItem.ID}`;

  // Проверка и удаление всех сервисов + throwError
  await dockerCheckAndRemoveSupportServices(nodeKey);

  logInfo('dockerCleanNodeItem.PROCESS', logData);

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
      execShell: 'sh',
      execCommand: 'docker image prune -a -f',
    });
    logInfo('dockerCleanNodeItem.image.WAIT_FOR_COMPLETE', logData2);

    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanImageServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT);

    logInfo('dockerCleanNodeItem.image.OK', logData2);
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
      execShell: 'sh',
      execCommand: 'docker builder prune -f',
    });
    logInfo('dockerCleanNodeItem.builder.WAIT_FOR_COMPLETE', logData2);
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanBuilderServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT);
    logInfo('dockerCleanNodeItem.builder.OK', logData2);
  } catch (err) {
    logError('dockerCleanNodeItem.builder.ERR', err, logData);
  }

  //---------
  //CONTAINER (exited and others)
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
      execShell: 'sh',
      execCommand: 'docker container prune -f',
    });
    logInfo('dockerCleanNodeItem.container.WAIT_FOR_COMPLETE', logData2);
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(
      cleanContainerServiceName,
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
    );
    logInfo('dockerCleanNodeItem.container.OK', logData2);
  } catch (err) {
    logError('dockerCleanNodeItem.container.ERR', err, logData);
  }
}
