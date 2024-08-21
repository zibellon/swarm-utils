import { dockerRegistryIsCanAuth } from 'src/utils/docker/utils-docker';
import { dockerApiLogin, dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { dockerUpdateServiceList } from 'src/utils/docker/utils-docker-update-service';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { logWarn } from 'src/utils/utils-logger';
import { tokenIsAdmin } from 'src/utils/utils-token';

type UpdateServiceExecParams = {
  token: string;
  serviceName: string;
  registryAuth: boolean;
  image?: string;
};

export async function updateServiceExec(params: UpdateServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.serviceName,
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

  let registryAuth = false;

  // Если нужна авторизация (Передается через query)
  if (params.registryAuth === true && dockerRegistryIsCanAuth()) {
    await dockerApiLogin({
      user: getProcessEnv().SWARM_UTILS_REGISTRY_USER,
      password: getProcessEnv().SWARM_UTILS_REGISTRY_PASSWORD,
      registryUrl: getProcessEnv().SWARM_UTILS_REGISTRY_URL,
    });
    registryAuth = true;
  }

  // Запуск сервиса для выполнения update CMD
  await dockerUpdateServiceList(serviceList, {
    registryAuth: params.registryAuth,
    image: params.image,
  });
}
