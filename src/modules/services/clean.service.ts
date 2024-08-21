import { dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { dockerCleanServiceList } from 'src/utils/docker/utils-docker-clean-service';
import { logWarn } from 'src/utils/utils-logger';
import { tokenIsAdmin } from 'src/utils/utils-token';

type CleanServiceExecParams = {
  token: string;
  serviceName: string;
};

export async function cleanServiceExec(params: CleanServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.serviceName,
    },
    {
      key: 'label',
      value: 'swarm-utils.clean.enable=true',
    },
  ];
  if (!isAdmin) {
    filterList.push({
      key: 'label',
      value: `swarm-utils.clean.token=${params.token}`,
    });
  }

  const serviceList = await dockerApiServiceLs(filterList);
  if (serviceList.length === 0) {
    logWarn('cleanServiceExec.NOT_FOUND', {
      params,
    });
    return;
  }

  await dockerCleanServiceList(serviceList);
}
