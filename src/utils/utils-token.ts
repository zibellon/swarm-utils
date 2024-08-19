import { getProcessEnv } from './utils-env-config';

export function tokenIsAdmin(token: string) {
  return getProcessEnv().SWARM_UTILS_ADMIN_TOKEN_LIST.split(',').indexOf(token) !== -1;
}
