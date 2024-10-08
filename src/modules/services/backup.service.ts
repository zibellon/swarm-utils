import { dockerBackupServiceList } from 'src/utils/actions/backup-service/backup-service-list';
import { dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { authIsTokenAdmin } from 'src/utils/utils-auth';
import { throwErrorSimple } from 'src/utils/utils-error';

type BackupServiceExecParams = {
  token: string;
  serviceName: string;
};
export async function backupServiceExec(params: BackupServiceExecParams) {
  const isAdmin = authIsTokenAdmin(params.token);

  const filterList: DockerApiServiceLsFilter[] = [
    {
      key: 'name',
      value: params.serviceName,
    },
    {
      key: 'label',
      value: 'swarm-utils.backup.enable=true',
    },
  ];
  if (!isAdmin) {
    filterList.push({
      key: 'label',
      value: `swarm-utils.backup.token=${params.token}`,
    });
  }
  const serviceList = await dockerApiServiceLs(filterList);
  if (serviceList.length === 0) {
    throwErrorSimple('backupServiceExec.NOT_FOUND', {
      params,
      filterList,
    });
  }
  const resultList = await dockerBackupServiceList({
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
    throwErrorSimple('backupServiceExec.ERR', {
      resultList,
    });
  }

  return {
    resultList,
  };
}
