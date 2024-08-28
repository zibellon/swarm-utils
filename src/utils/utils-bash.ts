import { spawnSync } from 'child_process';
import { throwErrorSimple } from './utils-error';
import { logError, logInfo } from './utils-logger';
import { MaskItem, maskString } from './utils-mask';

export type BashExecParams = {
  maskList?: MaskItem[];
  cleanLogRegexList?: RegExp[];
};
export async function bashExec(inputCommand: string, params?: BashExecParams) {
  let logInputCommand = inputCommand;
  if (params && params.maskList) {
    logInputCommand = maskString(logInputCommand, params.maskList);
  }

  try {
    logInfo('bashExec.INIT', {
      inputCommand: logInputCommand,
    });
    const result = spawnSync('bash', {
      encoding: 'utf-8',
      input: inputCommand,
    });

    // remove \n from start and end of line
    result.stdout = result.stdout.replace(/^\s+|\s+$/g, '');
    result.stderr = result.stderr.replace(/^\s+|\s+$/g, '');

    let stdoutLog = result.stdout;

    // Чистка лога от лишних полей. Если указано
    if (params && params.cleanLogRegexList && params.cleanLogRegexList.length > 0) {
      for (const reg of params.cleanLogRegexList) {
        // Удаление свойства Env
        stdoutLog = stdoutLog.replace(reg, '');
      }
    }

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
