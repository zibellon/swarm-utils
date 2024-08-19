import { bashExec } from '../utils-bash';

//---------
//docker login -u $REGISTRY_USER -p $REGISTRY_PASS $REGISTRY_URL

//---------
export type DockerApiLoginParams = {
  user: string;
  password: string;
  registryUrl: string;
};
export function dockerApiLoginCmd(params: DockerApiLoginParams) {
  return `docker login -u ${params.user} -p ${params.password} ${params.registryUrl}`;
}
export async function dockerApiLogin(params: DockerApiLoginParams) {
  const cmd = dockerApiLoginCmd(params);
  return await bashExec(cmd);
}

//---------
//docker node ls
//---------
export type DockerApiNodeLsItem = {
  Availability: string; // 'Active'
  EngineVersion: string; // '27.1.1'
  Hostname: string; // 'internal-worker-1'
  ID: string; // '4h17957q29d551j6ekqrbvejj'
  ManagerStatus: string; // ''
  Self: boolean; // false;
  Status: string; // 'Ready'
  TLSStatus: string; // 'Ready'
};
export type DockerApiNodeLsFilter = {
  key: 'id' | 'label' | 'node.label' | 'membership' | 'name' | 'role';
  value: string;
};
export function dockerApiNodeLsCmd(filterList: DockerApiNodeLsFilter[] = []) {
  let cmd = `docker node ls --format json`;
  for (const filter of filterList) {
    cmd += ` --filter ${filter.key}=${filter.value}`;
  }
  return cmd;
}
export async function dockerApiNodeLs(filterList: DockerApiNodeLsFilter[] = []) {
  const cmd = dockerApiNodeLsCmd(filterList);
  const result = await bashExec(cmd);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiNodeLsItem);
}

//---------
//docker volume ls
//---------
export type DockerApiVolumeLsItem = {
  Availability: string; // 'N/A'
  Driver: string; // 'local'
  Group: string; // 'N/A'
  Labels: string; // ''
  Links: string; // 'N/A'
  Mountpoint: string; // '/var/lib/docker/volumes/grafana-data/_data'
  Name: string; // 'grafana-data'
  Scope: string; // 'local'
  Size: string; // 'N/A'
  Status: string; // 'N/A'
};
export type DockerApiVolumeLsFilter = {
  key: 'dangling' | 'driver' | 'label' | 'name';
  value: string;
};
export function dockerApiVolumeLsCmd(filterList: DockerApiVolumeLsFilter[] = []) {
  let cmd = `docker volume ls --format json`;
  for (const filter of filterList) {
    cmd += ` --filter ${filter.key}=${filter.value}`;
  }
  return cmd;
}
export async function dockerApiVolumeLs(filterList: DockerApiVolumeLsFilter[] = []) {
  const cmd = dockerApiVolumeLsCmd(filterList);
  const result = await bashExec(cmd);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiVolumeLsItem);
}

//---------
//docker service ls --format json
//---------
export type DockerApiServiceLsItem = {
  ID: string; // 'c7gvk4c8iej6';
  Image: string; // 'registry.domain.com/image-name:tag';
  Mode: string; // 'replicated';
  Name: string; // 'stack-name_service-name, back-dev_dev, back-dev=STACK, dev=SERVICE';
  Ports: string; // '*:3717-\u003e9443/tcp';
  Replicas: string; // '1/1';
};
export type DockerApiServiceLsFilter = {
  key: 'id' | 'label' | 'mode' | 'name';
  value: string;
};
export function dockerApiServiceLsCmd(filterList: DockerApiServiceLsFilter[] = []) {
  let cmd = `docker service ls --format json`;
  for (const filter of filterList) {
    cmd += ` --filter ${filter.key}=${filter.value}`;
  }
  return cmd;
}
export async function dockerApiServiceLs(filterList: DockerApiServiceLsFilter[] = []) {
  const cmd = dockerApiServiceLsCmd(filterList);
  const result = await bashExec(cmd);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiServiceLsItem);
}

//---------
//docker service ps ${SERVICE_NAME} --format json
//taskList in service. !important!
//---------
export type DockerApiServicePsItem = {
  CurrentState: string; // 'Running 2 days ago'
  DesiredState: string; // 'Running'
  Error: string; // ''
  ID: string; // '27zetdb6h0eq', taskId
  Image: string; // 'registry.domain.com/image-name:tag'
  Name: string; // 'stack-name_service-name.1'; // taskName
  Node: string; // 'internal-worker-3'; // taskNode, hostname
  Ports: string; // ''
};
export type DockerApiServicePsFilter = {
  key: 'id' | 'name' | 'node' | 'desired-state';
  value: string;
};
export function dockerApiServicePsCmd(serviceName: string, filterList: DockerApiServicePsFilter[] = []) {
  let cmd = `docker service ps ${serviceName} --format json`;
  for (const filter of filterList) {
    cmd += ` --filter ${filter.key}=${filter.value}`;
  }
  return cmd;
}
export async function dockerApiServicePs(serviceName: string, filterList: DockerApiServicePsFilter[] = []) {
  const cmd = dockerApiServicePsCmd(serviceName, filterList);
  const result = await bashExec(cmd);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiServicePsItem);
}

//---------
//docker service update ${SERVICE_NAME} --force
//docker service update --with-registry-auth --image=$IMAGE_NAME:dev-latest
//---------
export type DockerApiServiceUpdateParams = {
  registryAuth?: boolean;
  image?: string; // image-name:tag
};
export function dockerApiServiceUpdateCmd(serviceName: string, params: DockerApiServiceUpdateParams = {}) {
  let cmd = `docker service update ${serviceName} --force`;
  if (typeof params.registryAuth === 'boolean' && params.registryAuth === true) {
    cmd += ` --with-registry-auth`;
  }
  if (typeof params.image === 'string' && params.image.length > 0) {
    cmd += ` --image=${params.image}`;
  }
  return cmd;
}
export async function dockerApiServiceUpdate(serviceName: string, params: DockerApiServiceUpdateParams = {}) {
  const cmd = dockerApiServiceUpdateCmd(serviceName, params);
  return await bashExec(cmd);
}

//---------
//docker service scale ${SERVICE_NAME}=${REPLICAS_COUNT}
//---------
export function dockerApiServiceScaleCmd(serviceName: string, replicas: number) {
  return `docker service scale ${serviceName}=${replicas}`;
}
export async function dockerApiServiceScale(serviceName: string, replicas: number) {
  const cmd = dockerApiServiceScaleCmd(serviceName, replicas);
  return await bashExec(cmd);
}

//---------
//docker service rm ${SERVICE_NAME}
//---------
export function dockerApiServiceRemoveCmd(serviceName: string) {
  return `docker service remove ${serviceName}`;
}
export async function dockerApiServiceRemove(serviceName: string) {
  const cmd = dockerApiServiceRemoveCmd(serviceName);
  return await bashExec(cmd);
}

//---------
//docker service logs ${serviceIdOrTaskId} --raw
//---------
export function dockerApiServiceLogsCmd(serviceIdOrTaskId: string) {
  return `docker service logs ${serviceIdOrTaskId} --raw`;
}
export async function dockerApiServiceLogs(serviceIdOrTaskId: string) {
  const cmd = dockerApiServiceLogsCmd(serviceIdOrTaskId);
  const result = await bashExec(cmd);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el));
}

//---------
//docker service create ...
//---------
export type DockerApiServiceCreateParams = {
  name: string;
  mode: string; // replicated
  replicas?: number; // 1
  constraint: string; // node.hostname==$taskNode
  'restart-condition': string; // none
  detach: boolean; // true
  mountList: string[]; // type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly
  image: string; // docker:25.0.5-cli-alpine3.20
  execShell?: 'sh' | 'bash';
  execCommand?: string;
};
export function dockerApiServiceCreateCmd(params: DockerApiServiceCreateParams) {
  let cmd = `docker service create`;
  if (params.detach === true) {
    cmd += ` --detach`;
  }
  cmd += ` --name ${params.name}`;
  cmd += ` --mode ${params.mode}`;
  if (typeof params.replicas === 'number' && params.replicas > 0) {
    cmd += ` --replicas ${params.replicas}`;
  } else if (params.mode === 'replicated') {
    cmd += ` --replicas 1`;
  }
  cmd += ` --constraint ${params.constraint}`;
  cmd += ` --restart-condition ${params['restart-condition']}`;
  for (const mount of params.mountList) {
    cmd += ` --mount ${mount}`;
  }
  cmd += ` ${params.image}`;
  if (typeof params.execShell === 'string' && typeof params.execCommand === 'string') {
    cmd += ` ${params.execShell} -c "${params.execCommand}"`;
  }
  return cmd;
}
export async function dockerApiServiceCreate(params: DockerApiServiceCreateParams) {
  const cmd = dockerApiServiceCreateCmd(params);
  return await bashExec(cmd);
}

//---------
//docker inspect ${SERVICE_ID} --type service --format json
//docker service ls --format json -> .ID -> docker inspect c7gvk4c8iej6
//---------
export type DockerApiInspectServiceItem = {
  ID: string; // 'c7gvk4c8iej609z9wjowlmn62';
  Version: {
    Index: number; // 4983
  };
  CreatedAt: string; // '2024-08-14T10:59:07.247069194Z'
  UpdatedAt: string; // '2024-08-14T10:59:30.25468235Z'
  Spec: {
    Name: string; // 'stack-name_service-name'; // test-back-dev_dev, test-back-dev=STACK, dev=SERVICE
    Labels: {
      [key: string]: string;
      // 'com.docker.stack.image': 'registry.domain.com/image-name:tag';
      // 'com.docker.stack.namespace': 'stack-name';
      // 'traefik.enable': 'true';
      // 'traefik.http.routers.router-test-back-dev-http.entryPoints': 'web';
      // 'traefik.http.routers.router-test-back-dev-http.rule': 'Host(`api-dev.domain.com`)';
      // 'traefik.http.routers.router-test-back-dev-http.service': 'service-test-back-dev';
      // 'traefik.http.services.service-test-back-dev.loadbalancer.server.port': '3000';
    };
    TaskTemplate: {
      ContainerSpec: {
        Image: string; // 'registry.domain.com/image-name:tag@sha256:xxxxxxxx';
        Labels: {
          [key: string]: string;
          // 'com.docker.stack.namespace': 'stack-name';
        };
        Env: string[]; // ['REDIS_PASSWORD=some_secret_password', 'WEB_APP_URL=https://app.domain.com'];
      };
    };
  };
  UpdateStatus: {
    State: string; // 'completed';
    StartedAt: string; // '2024-08-14T10:59:07.243899261Z';
    CompletedAt: string; // '2024-08-14T10:59:35.260628303Z';
    Message: string; // 'update completed';
  };
};
export function dockerApiInspectServiceCmd(serviceId: string) {
  return `docker inspect ${serviceId} --type service --format json`;
}
export async function dockerApiInspectService(serviceId: string) {
  const cmd = dockerApiInspectServiceCmd(serviceId);
  const result = await bashExec(cmd);
  const mappedResultList = result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiInspectServiceItem);
  return mappedResultList.length > 0 ? mappedResultList[0] : null;
}

//---------
//docker inspect ${TASK_ID} --type task --format json
//docker service ps ${SERVICE_NAME} --format json -> .ID -> docker inspect 27zetdb6h0eq
//---------
export type DockerApiInspectTaskItem = {
  ID: string; // '27zetdb6h0eq5s32vlhnqdkhs',
  Version: {
    Index: number; // 4982,
  };
  CreatedAt: string; // '2024-08-14T10:59:07.247069194Z'
  UpdatedAt: string; // '2024-08-14T10:59:30.25468235Z'
  Labels: {
    [key: string]: string;
  };
  Spec: {
    ContainerSpec: {
      Image: string; // 'registry.domain.com/image-name:tag@sha256:xxxxxxxx'
      Labels: {
        [key: string]: string;
        // 'com.docker.stack.namespace': 'stack-name';
      };
      Env: string[]; // ['REDIS_PASSWORD=some_secret_password', 'WEB_APP_URL=https://app.domain.com'];
    };
  };
  ServiceID: string; // 'c7gvk4c8iej609z9wjowlmn62'
  Slot: number; // 1
  NodeID: string; // 'n894nbopu8e41n2fa2o3wnj1n'
  Status: {
    Timestamp: string; // '2024-08-14T10:59:30.167664604Z'
    State: string; // 'running', 'shutdown'
    Message: string; // 'started'
    ContainerStatus: {
      ContainerID: string; // '84ec08ad826849b8a5d86758912eda93cf717b266b232c879bc5fbb1adc2de45'
      PID: number; // 355406
      ExitCode: number; // 0
    };
  };
  DesiredState: string; // 'running', 'shutdown'
};
export function dockerApiInspectTaskCmd(taskId: string) {
  return `docker inspect ${taskId} --type task --format json`;
}
export async function dockerApiInspectTask(taskId: string) {
  const cmd = dockerApiInspectTaskCmd(taskId);
  const result = await bashExec(cmd);
  const mappedResultList = result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerApiInspectTaskItem);
  return mappedResultList.length > 0 ? mappedResultList[0] : null;
}
