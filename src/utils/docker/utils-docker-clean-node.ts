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

export async function dockerCleanNodeList(nodeList: DockerApiNodeLsItem[]) {
  for (const nodeItem of nodeList) {
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

    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;

    const lockKey = nameLock(nodeItem.ID);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          await dockerCleanNodeItem(nodeItem, nodeInspectInfo);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerCleanNodeList.nodeItem.ERR', err, {
          nodeItem,
        });
      });
  }
}

async function dockerCleanNodeItem(nodeItem: DockerApiNodeLsItem, nodeInspectInfo: DockerApiInspectNodeItem) {
  const logData = {
    nodeItem,
  };
  logInfo('dockerCleanNodeItem.INIT', logData);

  const nodeKey = `${nodeItem.ID}`;

  // Проверка и удаление всех сервисов + throwError
  await dockerCheckAndRemoveSupportServices(nodeKey);

  //---------
  //IMAGES
  //---------
  try {
    const cleanImagesServiceName = nameCleanNodeImages(nodeKey);
    await dockerApiServiceCreate({
      detach: true,
      name: cleanImagesServiceName,
      image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
      mode: 'replicated',
      replicas: 1,
      constraint: `node.id==${nodeItem.ID}`,
      'restart-condition': 'none',
      mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
      execShell: 'sh',
      execCommand: 'docker image prune -a -f',
    });
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanImagesServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT);
  } catch (err) {
    logError('dockerCleanNodeItem.image.ERR', err, logData);
  }

  //---------
  //BUILDER_CACHE
  //---------
  try {
    const cleanBuilderServiceName = nameCleanNodeBuilder(nodeKey);
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
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(cleanBuilderServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT);
  } catch (err) {
    logError('dockerCleanNodeItem.builder.ERR', err, logData);
  }

  //---------
  //EXIT_CONTAINERS
  //---------
  try {
    const cleanContainerServiceName = nameCleanNodeContainers(nodeKey);
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
    // WAIT FOR SERVICE COMPLETE
    await dockerWaitForServiceComplete(
      cleanContainerServiceName,
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
    );
  } catch (err) {
    logError('dockerCleanNodeItem.container.ERR', err, logData);
  }
}
