import { getProcessEnv } from './utils-env-config';

export function registryIsCanAuth() {
  let needAuth = false;
  if (
    getProcessEnv().SWARM_UTILS_REGISTRY_URL.length > 0 &&
    getProcessEnv().SWARM_UTILS_REGISTRY_USER.length > 0 &&
    getProcessEnv().SWARM_UTILS_REGISTRY_PASSWORD.length > 0
  ) {
    needAuth = true;
  }
  return needAuth;
}
