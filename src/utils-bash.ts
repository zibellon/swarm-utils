import { spawnSync } from 'child_process';
import { logError, logInfo, logWarn } from './utils-logger';
import { throwErrorSimple } from './utils-error';

export async function bashExec(inputCommand: string) {
  try {
    logInfo('bashExec.INIT', {
      inputCommand,
    });
    const result = spawnSync('bash', {
      encoding: 'utf-8',
      input: inputCommand,
    });

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
