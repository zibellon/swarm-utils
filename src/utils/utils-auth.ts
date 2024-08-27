import { getProcessEnv } from './utils-env-config';

export function authIsTokenAdmin(token: string) {
  return getProcessEnv().SWARM_UTILS_ADMIN_TOKEN_LIST.split(',').indexOf(token) !== -1;
}

// labelsPrefix = swarm-utils.update
export function authGetRegistryAuthParams(labelsObj: Record<string, string>, labelsPrefix: string) {
  const registryUserLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.registry.user` && el[1].length > 0;
  });
  const registryPasswordLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.registry.password` && el[1].length > 0;
  });
  const registryUrlLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.registry.url` && el[1].length > 0;
  });

  const registryUser = registryUserLabelObj ? registryUserLabelObj[1] : getProcessEnv().SWARM_UTILS_REGISTRY_USER;
  const registryPassword = registryPasswordLabelObj
    ? registryPasswordLabelObj[1]
    : getProcessEnv().SWARM_UTILS_REGISTRY_PASSWORD;
  const registryUrl = registryUrlLabelObj ? registryUrlLabelObj[1] : getProcessEnv().SWARM_UTILS_REGISTRY_URL;

  if (registryUser.length === 0 || registryPassword.length === 0 || registryUrl.length == 0) {
    return null;
  }
  return {
    registryUrl: registryUrl,
    user: registryUser,
    password: registryPassword,
  };
}

export type AuthGetS3ParamsRes = {
  url: string;
  https: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  retentionDays: number;
};
// labelsPrefix = swarm-utils.backup.volume-list-upload
export function authGetS3Params(labelsObj: Record<string, string>, labelsPrefix: string): AuthGetS3ParamsRes | null {
  const s3UrlLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.url` && el[1].length > 0;
  });
  const s3HttpsLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.https` && el[1].length > 0;
  });
  const s3AccessKeyLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.access-key` && el[1].length > 0;
  });
  const s3SecretKeyLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.secret-key` && el[1].length > 0;
  });
  const s3BucketLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.bucket` && el[1].length > 0;
  });
  const s3RetentionDaysLabelObj = Object.entries(labelsObj).find((el) => {
    return el[0] === `${labelsPrefix}.s3.retention-days` && el[1].length > 0;
  });

  const s3Url = s3UrlLabelObj ? s3UrlLabelObj[1] : getProcessEnv().SWARM_UTILS_S3_URL;
  const s3Https = s3HttpsLabelObj ? s3HttpsLabelObj[1] === 'true' : getProcessEnv().SWARM_UTILS_S3_HTTPS;
  const s3AccessKey = s3AccessKeyLabelObj ? s3AccessKeyLabelObj[1] : getProcessEnv().SWARM_UTILS_S3_ACCESS_KEY;
  const s3SecretKey = s3SecretKeyLabelObj ? s3SecretKeyLabelObj[1] : getProcessEnv().SWARM_UTILS_S3_SECRET_KEY;
  const s3Bucket = s3BucketLabelObj ? s3BucketLabelObj[1] : getProcessEnv().SWARM_UTILS_S3_BUCKET;
  const s3RetentionDays = s3RetentionDaysLabelObj
    ? Number(s3RetentionDaysLabelObj[1])
    : getProcessEnv().SWARM_UTILS_S3_RETENTION_DAYS;

  if (s3Url.length === 0 || s3AccessKey.length === 0 || s3SecretKey.length == 0 || s3Bucket.length === 0) {
    return null;
  }
  return {
    url: s3Url,
    https: s3Https,
    accessKey: s3AccessKey,
    secretKey: s3SecretKey,
    bucket: s3Bucket,
    retentionDays: s3RetentionDays,
  };
}
