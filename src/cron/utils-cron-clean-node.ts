import { dockerCleanNodeList } from 'src/utils/actions/clean-node/clean-node-list';
import { dockerApiNodeLs } from 'src/utils/docker/utils-docker-api';
import { logInfo } from 'src/utils/utils-logger';

export async function cronCleanNodeList(dateCron: Date) {
  logInfo('cronCleanNodeList.INIT', {
    dateCron,
  });

  // Очистка Node
  const nodeList = await dockerApiNodeLs();
  await dockerCleanNodeList({
    nodeList: nodeList,
  });
}
