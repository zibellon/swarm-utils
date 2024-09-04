import { dockerCleanServiceList } from 'src/utils/actions/clean-service/clean-service-list';
import { dockerApiServiceLs } from 'src/utils/docker/utils-docker-api';
import { logInfo } from 'src/utils/utils-logger';

export async function cronCleanServiceList(dateCron: Date) {
  logInfo('cronCleanServiceList.INIT', {
    dateCron,
  });

  const serviceList = await dockerApiServiceLs([
    {
      key: 'label',
      value: 'swarm-utils.clean.enable=true',
    },
  ]);
  await dockerCleanServiceList({
    serviceList: serviceList,
  });
}
