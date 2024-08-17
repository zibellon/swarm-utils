import { bashExec } from './utils-bash';

//---------
//docker login -u $REGISTRY_USER -p $REGISTRY_PASS $REGISTRY_URL
//---------
export type DockerLoginParams = {
  user: string;
  password: string;
  registryUrl: string;
};
export async function dockerLogin(params: DockerLoginParams) {
  return await bashExec(`docker login -u ${params.user} -p ${params.password} ${params.registryUrl}`);
}

//---------
//docker node ls
//---------
export type DockerNodeLsItem = {
  Availability: string; // 'Active'
  EngineVersion: string; // '27.1.1'
  Hostname: string; // 'internal-worker-1'
  ID: string; // '4h17957q29d551j6ekqrbvejj'
  ManagerStatus: string; // ''
  Self: boolean; // false;
  Status: string; // 'Ready'
  TLSStatus: string; // 'Ready'
};
export type DockerNodeLsFilter = {
  key: 'id' | 'label' | 'node.label' | 'membership' | 'name' | 'role';
  value: string;
};
export async function dockerNodeLs(filterList: DockerNodeLsFilter[] = []): Promise<DockerNodeLsItem[]> {
  let exec = `docker node ls --format json`;
  for (const filter of filterList) {
    exec += ` --filter ${filter.key}=${filter.value}`;
  }
  const result = await bashExec(exec);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerNodeLsItem);
}

//---------
//docker volume ls
//---------
export type DockerVolumeLsItem = {
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
export type DockerVolumeLsFilter = {
  key: 'dangling' | 'driver' | 'label' | 'name';
  value: string;
};
export async function dockerVolumeLs(filterList: DockerVolumeLsFilter[] = []): Promise<DockerVolumeLsItem[]> {
  let exec = `docker volume ls --format json`;
  for (const filter of filterList) {
    exec += ` --filter ${filter.key}=${filter.value}`;
  }
  const result = await bashExec(exec);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerVolumeLsItem);
}

//---------
//docker service ls --format json
//---------
export type DockerServiceLsItem = {
  ID: string; // 'c7gvk4c8iej6';
  Image: string; // 'registry.domain.com/image-name:tag';
  Mode: string; // 'replicated';
  Name: string; // 'stack-name_service-name, back-dev_dev, back-dev=STACK, dev=SERVICE';
  Ports: string; // '*:3717-\u003e9443/tcp';
  Replicas: string; // '1/1';
};
export type DockerServiceLsFilter = {
  key: 'id' | 'label' | 'mode' | 'name';
  value: string;
};
export async function dockerServiceLs(filterList: DockerServiceLsFilter[] = []): Promise<DockerServiceLsItem[]> {
  let exec = `docker service ls --format json`;
  for (const filter of filterList) {
    exec += ` --filter ${filter.key}=${filter.value}`;
  }
  const result = await bashExec(exec);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerServiceLsItem);
}

//---------
//docker service ps ${SERVICE_NAME} --format json
//taskList in service. !important!
//---------
export type DockerServicePsItem = {
  CurrentState: string; // 'Running 2 days ago'
  DesiredState: string; // 'Running'
  Error: string; // ''
  ID: string; // '27zetdb6h0eq', taskId
  Image: string; // 'registry.domain.com/image-name:tag'
  Name: string; // 'stack-name_service-name.1'; // taskName
  Node: string; // 'internal-worker-3'; // taskNode, hostname
  Ports: string; // ''
};
export type DockerServicePsFilter = {
  key: 'id' | 'name' | 'node' | 'desired-state';
  value: string;
};
export async function dockerServicePs(
  service: string,
  filterList: DockerServicePsFilter[] = []
): Promise<DockerServicePsItem[]> {
  let exec = `docker service ps ${service} --format json`;
  for (const filter of filterList) {
    exec += ` --filter ${filter.key}=${filter.value}`;
  }
  const result = await bashExec(exec);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerServicePsItem);
}

//---------
//docker service update ${SERVICE_NAME} --force
//docker service update --with-registry-auth --image=$IMAGE_NAME:dev-latest
//---------
export type DockerServiceUpdateParams = {
  registryAuth?: boolean;
  image?: string; // image-name:tag
};
export async function dockerServiceUpdate(service: string, params: DockerServiceUpdateParams = {}) {
  let exec = `docker service update ${service} --force`;
  if (typeof params.registryAuth === 'boolean' && params.registryAuth === true) {
    exec += ` --with-registry-auth`;
  }
  if (typeof params.image === 'string' && params.image.length > 0) {
    exec += ` --image=${params.image}`;
  }
  return await bashExec(exec);
}

//---------
//docker service scale ${SERVICE_NAME}=${REPLICAS_COUNT}
//---------
export async function dockerServiceScale(service: string, replicas: number) {
  return await bashExec(`docker service scale ${service}=${replicas}`);
}

//---------
//docker service rm ${SERVICE_NAME}
//---------
export async function dockerServiceRemove(service: string) {
  return await bashExec(`docker service remove ${service}`);
}

//---------
//docker service logs ${serviceIdOrTaskId} --raw
//---------
export async function dockerServiceLogs(serviceIdOrTaskId: string): Promise<any[]> {
  const result = await bashExec(`docker service logs ${serviceIdOrTaskId} --raw`);
  return result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el));
}

//---------
//docker service create ${serviceIdOrTaskId} --raw
//---------
export type DockerServiceCreateParams = {
  name: string;
  mode: string;
  replicas?: number;
  constraint: string; // node.hostname==$taskNode
  'restart-condition': string; // none
  detach: boolean;
  mountList: string[]; // type=bind,source=/var/run/docker.sock,destination=/var/run/docker.sock,readonly
  image: string; // docker:25.0.5-cli-alpine3.20
  execShell?: 'sh' | 'bash';
  execCommand?: string;
};
export async function dockerServiceCreate(params: DockerServiceCreateParams) {
  let exec = `docker service create`;

  if (params.detach === true) {
    exec += ` --detach`;
  }

  exec += ` --name ${params.name}`;
  exec += ` --mode ${params.mode}`;

  if (typeof params.replicas === 'number' && params.replicas > 0) {
    exec += ` --replicas ${params.replicas}`;
  }

  exec += ` --constraint ${params.constraint}`;
  exec += ` --restart-condition ${params['restart-condition']}`;

  for (const mount of params.mountList) {
    exec += ` --mount ${mount}`;
  }

  exec += ` ${params.image}`;

  if (typeof params.execShell === 'string' && typeof params.execCommand === 'string') {
    exec += ` ${params.execShell} -c "${params.execCommand}"`;
  }

  return await bashExec(exec);
}

//---------
//docker inspect ${SERVICE_ID} --type service --format json
//docker service ls --format json -> .ID -> docker inspect c7gvk4c8iej6
//---------
export type DockerInspectServiceItem = {
  ID: string; // 'c7gvk4c8iej609z9wjowlmn62';
  Version: {
    Index: number; // 4983
  };
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
export async function dockerInspectService(serviceId: string): Promise<DockerInspectServiceItem | null> {
  const result = await bashExec(`docker inspect ${serviceId} --type service --format json`);
  const mappedResultList = result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerInspectServiceItem);
  return mappedResultList.length > 0 ? mappedResultList[0] : null;
}

//---------
//docker inspect ${TASK_ID} --type task --format json
//docker service ps ${SERVICE_NAME} --format json -> .ID -> docker inspect 27zetdb6h0eq
//---------
export type DockerInspectTaskItem = {
  ID: string; // '27zetdb6h0eq5s32vlhnqdkhs',
  Version: {
    Index: number; // 4982,
  };
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
    State: string; // 'running'
    Message: string; // 'started'
    ContainerStatus: {
      ContainerID: string; // '84ec08ad826849b8a5d86758912eda93cf717b266b232c879bc5fbb1adc2de45'
      PID: number; // 355406
      ExitCode: number; // 0
    };
  };
  DesiredState: string; // 'running'
};
export async function dockerInspectTask(taskId: string): Promise<DockerInspectTaskItem | null> {
  const result = await bashExec(`docker inspect ${taskId} --type task --format json`);
  const mappedResultList = result.stdout
    .split('\n')
    .filter((el) => el.length > 0)
    .map((el) => JSON.parse(el) as DockerInspectTaskItem);
  return mappedResultList.length > 0 ? mappedResultList[0] : null;
}
