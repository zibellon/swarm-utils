import { spawnSync } from 'child_process';
import { throwErrorSimple } from './utils-error';
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

    // remove \n from start and end of line
    result.stdout = result.stdout.replace(/^\s+|\s+$/g, '');
    result.stderr = result.stderr.replace(/^\s+|\s+$/g, '');

    logInfo('bashExec.RESULT', {
      inputCommand,
      result,
    });

    if ((typeof result.signal === 'number' && result.signal !== 0) || result.stderr) {
      throwErrorSimple('bashExec.PRE_ERR', {
        inputCommand,
        result,
      });
    }

    return result;
  } catch (err) {
    logError('bashExec.ERR', err, {
      inputCommand,
    });
    throw err;
  }
}
