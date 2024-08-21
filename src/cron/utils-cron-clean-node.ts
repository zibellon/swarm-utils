import { dockerApiNodeLs } from 'src/utils/docker/utils-docker-api';
import { dockerCleanNodeList } from 'src/utils/docker/utils-docker-clean-node';
import { logInfo } from 'src/utils/utils-logger';

export async function cronCleanNodeList(dateCron: Date) {
  logInfo('cronCleanNodeList.INIT', {
    dateCron,
  });

  // Очистка Node
  const nodeList = await dockerApiNodeLs();
  await dockerCleanNodeList(nodeList);
}
