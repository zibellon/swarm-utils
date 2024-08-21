import { dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { dockerBackupServiceList } from 'src/utils/docker/utils-docker-backup-service';
import { logWarn } from 'src/utils/utils-logger';
import { tokenIsAdmin } from 'src/utils/utils-token';

type BackupServiceExecParams = {
  token: string;
  serviceName: string;
};

export async function backupServiceExec(params: BackupServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

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
    logWarn('backupServiceExec.NOT_FOUND', {
      params,
    });
    return;
  }
  await dockerBackupServiceList(serviceList);
}
