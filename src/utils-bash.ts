import { spawnSync } from 'child_process';
import { logError, logInfo } from './utils-logger';

export async function bashExec(inputCommand: string) {
  try {
    logInfo('bashExec.INIT', {
      inputCommand,
    });
    const result = spawnSync('bash', {
      encoding: 'utf-8',
      input: inputCommand,
    });
    logInfo('bashExec.RESULT', {
      inputCommand,
      result,
    });
    return result;
  } catch (err) {
    logError('bashExec.ERR', err, {
      inputCommand,
    });
    throw err;
  }
}
