import { DockerHelpServiceCompleteRes } from './utils-docker';

export type DockerProcessServiceResultItem = {
  isFailed: boolean;
  serviceId: string;
  serviceName: string;
  messageString?: string;
  messageJson?: any; // JSON
  helpServiceCompleteList: DockerHelpServiceCompleteRes[];
};

export type DockerProcessNodeResultItem = {
  isFailed: boolean;
  nodeId: string;
  nodeName: string;
  messageString?: string;
  messageJson?: any; // JSON
  helpServiceCompleteList: DockerHelpServiceCompleteRes[];
};
