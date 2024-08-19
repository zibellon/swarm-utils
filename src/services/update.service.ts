import { dockerRegistryIsCanAuth } from 'src/utils/docker/utils-docker';
import { dockerApiLogin, dockerApiServiceLs, DockerApiServiceLsFilter, dockerApiServiceUpdate } from 'src/utils/docker/utils-docker-api';
import { getProcessEnv } from 'src/utils/utils-env-config';
import { tokenIsAdmin } from 'src/utils/utils-token';

type UpdateServiceExecParams = {
  token: string;
  service: string;
  registryAuth: boolean;
  image?: string;
};

export async function updateServiceExec(params: UpdateServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.service,
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
    // LOG - что сервис не найден
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
  // ...

  await dockerApiServiceUpdate(params.service, {
    image: params.image,
    registryAuth,
  });
}
