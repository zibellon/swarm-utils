import { tokenIsAdmin } from 'src/utils/utils-token';

type BackupServiceExecParams = {
  token: string;
  serviceName: string;
};

export async function backupServiceExec(params: BackupServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);
}
