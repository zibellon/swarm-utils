import { getProcessEnv } from '../utils-env-config';
import { lockResource } from '../utils-lock';
import { logError, logInfo, logWarn } from '../utils-logger';
import {
  nameCleanNodeBuilder,
  nameCleanNodeContainers,
  nameCleanNodeImages,
  nameGetAllServiceNamesForNode,
  nameLock,
} from '../utils-names';
import { dockerServiceGetStatusInfo, dockerWaitForServiceComplete } from './utils-docker';
import {
  dockerApiInspectNode,
  DockerApiNodeLsItem,
  dockerApiServiceCreate,
  dockerApiServiceRemove,
} from './utils-docker-api';

export async function dockerCleanNodeList(nodeList: DockerApiNodeLsItem[]) {
  for (const nodeItem of nodeList) {
    const nodeKey = `${nodeItem.ID}`;
    const nodeInspectInfo = await dockerApiInspectNode(nodeItem.ID);

    const maxExecutionTime =
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT +
      getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;

    const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;

    const lockKey = nameLock(nodeKey);
    await lockResource
      .acquire(
        lockKey,
        async () => {
          await dockerCleanNodeItem(nodeItem);
        },
        {
          maxExecutionTime,
          maxOccupationTime,
        }
      )
      .catch((err) => {
        logError('dockerCleanNodeList.ERR', err, {
          nodeItem,
        });
      });
  }
}

async function dockerCleanNodeItem(nodeItem: DockerApiNodeLsItem) {
  logInfo('dockerCleanNodeItem.INIT', {
    nodeItem,
  });

  const nodeKey = `${nodeItem.ID}`;

  const allServiceNameList = nameGetAllServiceNamesForNode(nodeKey);

  let canContinue = true;
  const removeServiceNameList: string[] = [];

  for (const serviceName of allServiceNameList) {
    const serviceStatusInfo = await dockerServiceGetStatusInfo(serviceName);
    if (serviceStatusInfo.isExist) {
      if (serviceStatusInfo.canRemove) {
        // Сервис существует и его МОЖНО удалить
        removeServiceNameList.push(serviceName);
      } else {
        canContinue = false;
      }
    }
  }

  if (canContinue === false) {
    logWarn('dockerCleanNodeList.CANNOT_CONTINUE_1', {
      nodeItem,
    });
    return;
  }

  if (removeServiceNameList.length > 0) {
    for (const serviceName of removeServiceNameList) {
      await dockerApiServiceRemove(serviceName);
    }
  }

  // docker service create \
  //   --detach \
  //   --name $execServiceName \
  //   --mode replicated \
  //   --replicas 1 \
  //   --constraint node.hostname==$taskNode \
  //   --restart-condition none \
  //   --mount type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly \
  //   docker:25.0.5-cli-alpine3.20 sh -c "$execCommand"

  //---------
  //IMAGES
  //---------
  const cleanImagesServiceName = nameCleanNodeImages(nodeKey);
  await dockerApiServiceCreate({
    detach: true,
    name: cleanImagesServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.hostname==${nodeItem.Hostname}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execCommand: 'docker image prune -a -f',
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(cleanImagesServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_IMAGE_TIMEOUT);

  //---------
  //BUILDER_CACHE
  //---------
  const cleanBuilderServiceName = nameCleanNodeBuilder(nodeKey);
  await dockerApiServiceCreate({
    detach: true,
    name: cleanBuilderServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.hostname==${nodeItem.Hostname}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execCommand: 'docker builder prune -f',
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(cleanBuilderServiceName, getProcessEnv().SWARM_UTILS_CLEAN_NODE_BUILDER_TIMEOUT);

  //---------
  //EXIT_CONTAINERS
  //---------
  const cleanContainerServiceName = nameCleanNodeContainers(nodeKey);
  await dockerApiServiceCreate({
    detach: true,
    name: cleanContainerServiceName,
    image: getProcessEnv().SWARM_UTILS_DOCKER_CLI_IMAGE_NAME,
    mode: 'replicated',
    replicas: 1,
    constraint: `node.hostname==${nodeItem.Hostname}`,
    'restart-condition': 'none',
    mountList: ['type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly'],
    execCommand: 'docker container prune -f',
  });
  // WAIT FOR SERVICE COMPLETE
  await dockerWaitForServiceComplete(
    cleanContainerServiceName,
    getProcessEnv().SWARM_UTILS_CLEAN_NODE_CONTAINER_TIMEOUT
  );
}
