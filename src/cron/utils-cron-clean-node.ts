import { dockerServiceGetStatusInfo } from 'src/utils/docker/utils-docker';
import {
  dockerApiNodeLs,
  DockerApiNodeLsItem,
  dockerApiServiceCreate,
  dockerApiServiceRemove,
} from 'src/utils/docker/utils-docker-api';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { lockResource } from 'src/utils/utils-lock';
import { logError, logInfo, logWarn } from 'src/utils/utils-logger';
import {
  nameCleanNodeBuilder,
  nameCleanNodeImages,
  nameGetAllServiceNamesForNode,
  nameLock,
} from 'src/utils/utils-names';

export async function cronCleanNodeList(dateCron: Date) {
  logInfo('cronCleanNodeList.INIT', {
    dateCron,
  });

  // Очистка Node
  const nodeList = await dockerApiNodeLs();
  for (const node of nodeList) {
    await cronCleanNodeItem(node, dateCron);
  }
}

async function cronCleanNodeItem(nodeItem: DockerApiNodeLsItem, dateCron: Date) {
  logInfo('cronCleanNodeItem.INIT', {
    nodeItem,
    dateCron,
  });

  const nodeKey = `${nodeItem.ID}_${nodeItem.Hostname}`;

  const lockKey = nameLock(nodeKey);
  await lockResource
    .acquire(lockKey, async () => {
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
        logWarn('cronCleanNodeItem.CANNOT_CONTINUE_1', {
          nodeItem,
          dateCron,
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
      // ...

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
      // ...
    })
    .catch((err) => {
      logError('cronCleanNodeItem.ERR', err, {
        nodeItem,
        dateCron,
      });
    });
}
