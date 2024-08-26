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

    // Обрезать result = [0...20, last-20...last]
    const stdoutLen = result.stdout.length;
    // let stdoutLog = '';
    // if (stdoutLen > 80) {
    //   stdoutLog = `${result.stdout.slice(0, 20)}...${result.stdout.slice(stdoutLen - 21, stdoutLen)}}`;
    // } else if (stdoutLen > 40) {
    //   stdoutLog = `${result.stdout.slice(0, 10)}...${result.stdout.slice(stdoutLen - 11, stdoutLen)}}`;
    // } else if (stdoutLen > 20) {
    //   stdoutLog = `${result.stdout.slice(0, 5)}...${result.stdout.slice(stdoutLen - 5, stdoutLen)}}`;
    // } else if (stdoutLen > 10) {
    //   stdoutLog = `${result.stdout.slice(0, 3)}...${result.stdout.slice(stdoutLen - 3, stdoutLen)}}`;
    // } else {
    //   stdoutLog = result.stdout;
    // }
    const resultLog = {
      pid: result.pid,
      // output: Array<T | null>;
      stdout: result.stdout,
      stderr: result.stderr,
      status: result.status,
      signal: result.signal,
      error: result.error,
    };

    logInfo('bashExec.RESULT', {
      inputCommand,
      result: resultLog,
    });

    if (typeof result.signal === 'number' && result.signal !== 0) {
      throwErrorSimple('bashExec.PRE_ERR', {
        inputCommand,
        result: resultLog,
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
