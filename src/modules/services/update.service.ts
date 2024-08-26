import { dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { dockerUpdateServiceList } from 'src/utils/docker/utils-docker-update-service';
import { authIsTokenAdmin } from 'src/utils/utils-auth';
import { logWarn } from 'src/utils/utils-logger';

type UpdateServiceExecParams = {
  token: string;
  serviceName: string;
  force: boolean;
  image: string;
};
export async function updateServiceExec(params: UpdateServiceExecParams) {
  const isAdmin = authIsTokenAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.serviceName,
    },
    {
      key: 'label',
      value: 'swarm-utils.update.enable=true',
    },
  ];
  if (!isAdmin) {
    filterList.push({
      key: 'label',
      value: `swarm-utils.update.token=${params.token}`,
    });
  }

  const serviceList = await dockerApiServiceLs(filterList);
  if (serviceList.length === 0) {
    logWarn('updateServiceExec.NOT_FOUND', {
      params,
    });
    return;
  }
  await dockerUpdateServiceList([serviceList[0]], {
    force: params.force,
    image: params.image,
  });
}
