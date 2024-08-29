import { spawnSync } from 'child_process';
import { throwErrorSimple } from './utils-error';
import { logError, logInfo } from './utils-logger';

export type BashExecParams = {
  inputCommand: string;
  logInputCommand?: string;
};
export async function bashExec(params: BashExecParams) {
  let logInputCommand = params.inputCommand;
  if (params && params.logInputCommand && params.logInputCommand.length > 0) {
    logInputCommand = params.logInputCommand;
  }

  try {
    logInfo('bashExec.INIT', {
      inputCommand: logInputCommand,
    });
    const result = spawnSync('bash', {
      encoding: 'utf-8',
      input: params.inputCommand,
    });

    // remove \n from start and end of line
    result.stdout = result.stdout.replace(/^\s+|\s+$/g, '');
    result.stderr = result.stderr.replace(/^\s+|\s+$/g, '');

    let stdoutLog = `len=${result.stdout.length}`;

    const resultLog = {
      pid: result.pid,
      // output: Array<T | null>;
      stdout: stdoutLog,
      stderr: result.stderr,
      status: result.status,
      signal: result.signal,
      error: result.error,
    };

    logInfo('bashExec.RESULT', {
      inputCommand: logInputCommand,
      result: resultLog,
    });

    if (typeof result.signal === 'number' && result.signal !== 0) {
      throwErrorSimple('bashExec.PRE_ERR', {
        inputCommand: logInputCommand,
        result: resultLog,
      });
    }

    return result;
  } catch (err) {
    logError('bashExec.ERR', err, {
      inputCommand: logInputCommand,
    });
    throw err;
  }
}
