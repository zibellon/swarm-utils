import { DockerApiInspectNodeItem, DockerApiInspectServiceItem, DockerApiInspectTaskItem } from './utils-docker-api';

export function dockerLogInspectServiceItem(item: DockerApiInspectServiceItem) {
  const result = JSON.parse(JSON.stringify(item));
  delete result.Endpoint;
  delete result.PreviousSpec;
  delete result.Spec.UpdateConfig;
  delete result.Spec.RollbackConfig;
  delete result.Spec.EndpointSpec;
  delete result.Spec.Mode;
  delete result.Spec.Labels;
  delete result.Spec.TaskTemplate.Resources;
  delete result.Spec.TaskTemplate.RestartPolicy;
  delete result.Spec.TaskTemplate.RestartPolicy;
  delete result.Spec.TaskTemplate.LogDriver;
  delete result.Spec.TaskTemplate.Networks;
  delete result.Spec.TaskTemplate.Runtime;
  delete result.Spec.TaskTemplate.Placement.Platforms
  delete result.Spec.TaskTemplate.ContainerSpec.Mounts;
  delete result.Spec.TaskTemplate.ContainerSpec.Privileges;
  delete result.Spec.TaskTemplate.ContainerSpec.DNSConfig;
  delete result.Spec.TaskTemplate.ContainerSpec.Isolation;
  delete result.Spec.TaskTemplate.ContainerSpec.StopGracePeriod;
  delete result.Spec.TaskTemplate.ContainerSpec.Env;
  delete result.Spec.TaskTemplate.ContainerSpec.Labels;
  return result;
}

export function dockerLogInspectTaskItem(item: DockerApiInspectTaskItem) {
  const result = JSON.parse(JSON.stringify(item));
  delete result.NetworksAttachments;
  delete result.Volumes;
  delete result.Spec.Resources;
  delete result.Spec.Networks;
  delete result.Spec.LogDriver;
  delete result.Spec.RestartPolicy;
  delete result.Spec.Placement.Platforms;
  delete result.Spec.ContainerSpec.Mounts;
  delete result.Spec.ContainerSpec.Privileges;
  delete result.Spec.ContainerSpec.DNSConfig;
  delete result.Spec.ContainerSpec.Env;
  delete result.Spec.ContainerSpec.Labels;
  delete result.Spec.ContainerSpec.Isolation;
  return result;
}

export function dockerLogInspectNodeItem(item: DockerApiInspectNodeItem) {
  const result = JSON.parse(JSON.stringify(item));
  delete result.Description;
  delete result.Status;
  delete result.ManagerStatus;
  delete result.Spec.Labels;
  return result;
}
