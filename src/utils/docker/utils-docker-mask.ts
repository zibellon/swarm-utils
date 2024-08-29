import { AuthGetRegistryParamsRes, AuthGetS3ParamsRes } from '../utils-auth';
import { MaskItem, maskObj } from '../utils-mask';
import { DockerApiInspectNodeItem, DockerApiInspectServiceItem, DockerApiInspectTaskItem } from './utils-docker-api';

export function maskInspectServiceItem(item: DockerApiInspectServiceItem) {
  const removeKeyList = [
    'Endpoint',
    'PreviousSpec',
    'UpdateConfig',
    'RollbackConfig',
    'EndpointSpec',
    'Mode',
    'Labels',
    'Resources',
    'RestartPolicy',
    'LogDriver',
    'Networks',
    'Runtime',
    'Platforms',
    'Mounts',
    'Privileges',
    'DNSConfig',
    'Isolation',
    'StopGracePeriod',
    'Env',
  ];
  return maskObj({
    sourceObj: item,
    removeKeyList,
  });
}

export function maskInspectTaskItem(item: DockerApiInspectTaskItem) {
  const removeKeyList = [
    'NetworksAttachments',
    'Volumes',
    'Resources',
    'Networks',
    'LogDriver',
    'RestartPolicy',
    'Platforms',
    'Mounts',
    'Privileges',
    'DNSConfig',
    'Env',
    'Labels',
    'Isolation',
  ];
  return maskObj({
    sourceObj: item,
    removeKeyList,
  });
}

export function maskInspectNodeItem(item: DockerApiInspectNodeItem) {
  const removeKeyList = ['Description', 'Status', 'ManagerStatus', 'Labels'];
  return maskObj({
    sourceObj: item,
    removeKeyList,
  });
}

export function maskRegistryParams(sourceObj: AuthGetRegistryParamsRes) {
  const maskList: MaskItem[] = [
    {
      str: `"url":"${sourceObj.url}"`,
      val: sourceObj.url,
    },
    {
      str: `"password":"${sourceObj.password}"`,
      val: sourceObj.password,
    },
  ];
  return maskObj({
    sourceObj,
    maskList,
  });
}

export function maskS3Params(sourceObj: AuthGetS3ParamsRes) {
  const maskList: MaskItem[] = [
    {
      str: `"url":"${sourceObj.url}"`,
      val: sourceObj.url,
    },
    {
      str: `"accessKey":"${sourceObj.accessKey}"`,
      val: sourceObj.accessKey,
    },
    {
      str: `"secretKey":"${sourceObj.secretKey}"`,
      val: sourceObj.secretKey,
    },
  ];
  return maskObj({
    sourceObj,
    maskList,
  });
}
