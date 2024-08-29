import { dockerApiServiceLs, DockerApiServiceLsFilter } from 'src/utils/docker/utils-docker-api';
import { dockerBackupServiceList } from 'src/utils/docker/utils-docker-backup-service';
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
  await dockerBackupServiceList([serviceList[0]]);
}
