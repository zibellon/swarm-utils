import { dockerBackupServiceList } from 'src/utils/actions/backup-service/backup-service-list';
import { dockerApiServiceLs } from 'src/utils/docker/utils-docker-api';
import { logInfo } from 'src/utils/utils-logger';

export async function cronBackupServiceList(dateCron: Date) {
  logInfo('cronBackupServiceList.INIT', {
    dateCron,
  });

  const serviceList = await dockerApiServiceLs([
    {
      key: 'label',
      value: 'swarm-utils.backup.enable=true',
    },
  ]);
  await dockerBackupServiceList({
    serviceList: serviceList,
  });
}
