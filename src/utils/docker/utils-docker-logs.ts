import { DockerApiInspectNodeItem, DockerApiInspectServiceItem, DockerApiInspectTaskItem } from './utils-docker-api';

export function dockerLogInspectServiceItem(item: DockerApiInspectServiceItem) {
  const result = { ...item } as any;
  delete result.Endpoint;
  delete result.PreviousSpec;
  delete result.Spec.UpdateConfig;
  delete result.Spec.RollbackConfig;
  delete result.Spec.EndpointSpec;
  delete result.Spec.Mode;
  delete result.Spec.TaskTemplate.Resources;
  delete result.Spec.TaskTemplate.RestartPolicy;
  delete result.Spec.TaskTemplate.RestartPolicy;
  delete result.Spec.TaskTemplate.LogDriver;
  delete result.Spec.TaskTemplate.Networks;
  delete result.Spec.TaskTemplate.Runtime;
  delete result.Spec.TaskTemplate.ContainerSpec.Privileges;
  delete result.Spec.TaskTemplate.ContainerSpec.DNSConfig;
  delete result.Spec.TaskTemplate.ContainerSpec.Env;
  return result;
}

export function dockerLogInspectTaskItem(item: DockerApiInspectTaskItem) {
  const result = { ...item } as any;
  delete result.NetworksAttachments;
  delete result.Spec.Resources;
  delete result.Spec.Networks;
  delete result.Spec.LogDriver;
  delete result.Spec.ContainerSpec.Env;
  delete result.Spec.ContainerSpec.Privileges;
  delete result.Spec.ContainerSpec.Isolation;
  return result;
}

export function dockerLogInspectNodeItem(item: DockerApiInspectNodeItem) {
  const result = { ...item } as any;
  delete result.Description;
  delete result.Status;
  delete result.ManagerStatus;
  return result;
}
