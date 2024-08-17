import { dockerLogin, dockerServiceLs, DockerServiceLsFilter, dockerServiceUpdate } from 'src/utils-docker-api';
import { getProcessEnv } from 'src/utils-env-config';
import { registryIsCanAuth } from 'src/utils-registry';
import { tokenIsAdmin } from 'src/utils-token';

type UpdateServiceExecParams = {
  token: string;
  service: string;
  registryAuth: boolean;
  image?: string;
};

export async function updateServiceExec(params: UpdateServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  const filterList: DockerServiceLsFilter[] = [
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

  const serviceList = await dockerServiceLs(filterList);
  if (serviceList.length === 0) {
    // LOG - что сервис не найден
    return;
  }

  let registryAuth = false;

  // Если нужна авторизация (Передается через query)
  if (params.registryAuth === true && registryIsCanAuth()) {
    await dockerLogin({
      user: getProcessEnv().SWARM_UTILS_REGISTRY_USER,
      password: getProcessEnv().SWARM_UTILS_REGISTRY_PASSWORD,
      registryUrl: getProcessEnv().SWARM_UTILS_REGISTRY_URL,
    });
    registryAuth = true;
  }

  await dockerServiceUpdate(params.service, {
    image: params.image,
    registryAuth,
  });
}
