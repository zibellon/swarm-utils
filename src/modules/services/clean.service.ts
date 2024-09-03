import {
  dockerApiNodeLs,
  DockerApiNodeLsFilter,
  dockerApiServiceLs,
  DockerApiServiceLsFilter,
} from 'src/utils/docker/utils-docker-api';
import { dockerCleanNodeList } from 'src/utils/docker/utils-docker-clean-node';
import { dockerCleanServiceList } from 'src/utils/docker/utils-docker-clean-service';
import { authIsTokenAdmin } from 'src/utils/utils-auth';
import { throwErrorSimple } from 'src/utils/utils-error';

type CleanServiceExecParams = {
  token: string;
  serviceName: string;
};
export async function cleanServiceExec(params: CleanServiceExecParams) {
  const isAdmin = authIsTokenAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.serviceName,
    },
    {
      key: 'label',
      value: 'swarm-utils.clean.enable=true',
    },
  ];
  if (!isAdmin) {
    filterList.push({
      key: 'label',
      value: `swarm-utils.clean.token=${params.token}`,
    });
  }
  const serviceList = await dockerApiServiceLs(filterList);
  if (serviceList.length === 0) {
    throwErrorSimple('cleanServiceExec.NOT_FOUND', {
      params,
      filterList,
    });
  }
  const resultList = await dockerCleanServiceList({
    serviceList: [serviceList[0]],
  });

  let isFailed = false;
  for (const resultItem of resultList) {
    if (isFailed === true) {
      continue;
    }
    if (resultItem.isFailed === true) {
      isFailed = true;
    }
  }

  if (isFailed === true) {
    throwErrorSimple('cleanServiceExec.ERR', {
      resultList,
    });
  }

  return {
    resultList,
  };
}

type CleanNodeExecParams = {
  token: string;
  nodeName: string;
};
export async function cleanNodeExec(params: CleanNodeExecParams) {
  const isAdmin = authIsTokenAdmin(params.token);

  const filterList: DockerApiNodeLsFilter[] = [
    {
      key: 'name',
      value: params.nodeName,
    },
    // {
    //   key: 'label',
    //   value: 'swarm-utils.clean.enable=true',
    // },
  ];
  if (!isAdmin) {
    filterList.push({
      key: 'label',
      value: `swarm-utils.clean.token=${params.token}`,
    });
  }

  const nodeList = await dockerApiNodeLs(filterList);
  if (nodeList.length === 0) {
    throwErrorSimple('cleanNodeExec.NOT_FOUND', {
      params,
      filterList,
    });
  }
  const resultList = await dockerCleanNodeList({
    nodeList: [nodeList[0]],
  });

  let isFailed = false;
  for (const resultItem of resultList) {
    if (isFailed === true) {
      continue;
    }
    if (resultItem.isFailed === true) {
      isFailed = true;
    }
  }

  if (isFailed === true) {
    throwErrorSimple('cleanNodeExec.ERR', {
      resultList,
    });
  }

  return {
    resultList,
  };
}
