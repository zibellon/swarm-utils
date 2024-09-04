import {
  dockerCheckAndRmHelpServicesForNode,
  dockerHelpServiceCompleteInfo,
  DockerHelpServiceCompleteRes,
  dockerWaitForServiceComplete,
} from 'src/utils/docker/utils-docker';
import {
  DockerApiInspectNodeItem,
  DockerApiNodeLsItem,
  dockerApiServiceCreate,
} from 'src/utils/docker/utils-docker-api';
import { maskInspectNodeItem } from 'src/utils/docker/utils-docker-mask';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { logError, logInfo } from 'src/utils/utils-logger';
import { nameCleanNodeBuilder, nameCleanNodeContainers, nameCleanNodeImages } from 'src/utils/utils-names';

type DockerCleanNodeItemParams = {
  nodeItem: DockerApiNodeLsItem;
  nodeInspectInfo: DockerApiInspectNodeItem;
};
export async function dockerCleanNodeItem(params: DockerCleanNodeItemParams) {
  const logData = {
    ...params,
    nodeInspectInfo: maskInspectNodeItem(params.nodeInspectInfo),
  };
  logInfo('dockerCleanNodeItem.INIT', logData);

  // Проверка и удаление всех сервисов + throwError
  await dockerCheckAndRmHelpServicesForNode(params.nodeItem.ID);

  logInfo('dockerCleanNodeItem.PROCESS', logData);

  const helpServiceCompleteResultList: DockerHelpServiceCompleteRes[] = [];

  //---------
  //IMAGE
  //---------
  try {
    const cleanImageServiceName = nameCleanNodeImages(params.nodeItem.ID);
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
      constraint: `node.id==${params.nodeItem.ID}`,
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
    const cleanBuilderServiceName = nameCleanNodeBuilder(params.nodeItem.ID);
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
      constraint: `node.id==${params.nodeItem.ID}`,
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
    const cleanContainerServiceName = nameCleanNodeContainers(params.nodeItem.ID);
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
      constraint: `node.id==${params.nodeItem.ID}`,
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
