import { getProcessEnv } from './utils-env-config';

export function tokenIsAdmin(token: string) {
  return getProcessEnv().SWARM_UTILS_ADMIN_TOKEN_LIST.split(',').indexOf(token) !== -1;
}

export function authIsS3Enable() {
  return (
    getProcessEnv().SWARM_UTILS_S3_DOMAIN.length > 0 &&
    getProcessEnv().SWARM_UTILS_S3_BUCKET_NAME.length > 0 &&
    getProcessEnv().SWARM_UTILS_S3_ACCESS_KEY.length > 0 &&
    getProcessEnv().SWARM_UTILS_S3_SECRET_ACCESS_KEY.length > 0
  );
}
