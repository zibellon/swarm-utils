import { dockerApiServiceLs } from 'src/utils/docker/utils-docker-api';
import { dockerCleanServiceList } from 'src/utils/docker/utils-docker-clean-service';
import { logInfo } from 'src/utils/utils-logger';

export async function cronCleanServiceList(dateCron: Date) {
  logInfo('cronCleanServiceList.INIT', {
    dateCron,
  });

  // Очистка Service
  const serviceList = await dockerApiServiceLs([
    {
      key: 'label',
      value: 'swarm-utils.clean.enable=true',
    },
  ]);
  await dockerCleanServiceList(serviceList);
}
