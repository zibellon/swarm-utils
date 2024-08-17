import { tokenIsAdmin } from 'src/utils-token';

type CleanServiceExecParams = {
  token: string;
  service: string;
};

export async function cleanServiceExec(params: CleanServiceExecParams) {
  const isAdmin = tokenIsAdmin(params.token);

  
}
