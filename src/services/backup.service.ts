import { tokenIsAdmin } from 'src/utils-token';

type BackupServiceExecParams = {
  token: string;
  service: string;
};

export async function backupServiceExec(params: BackupServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  
}
