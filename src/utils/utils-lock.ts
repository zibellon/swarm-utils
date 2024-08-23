import AsyncLock from 'async-lock';
import { getProcessEnv } from './utils-env-config';

export const lockResource = new AsyncLock({
  timeout: getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT,
});

// // Specify timeout - max amount of time an item can remain in the queue before acquiring the lock
// var lock = new AsyncLock({timeout: 5000});
// lock.acquire(key, fn, function(err, ret) {
// 	// timed out error will be returned here if lock not acquired in given time
// });

// // Specify max occupation time - max amount of time allowed between entering the queue and completing execution
// var lock = new AsyncLock({maxOccupationTime: 3000});
// lock.acquire(key, fn, function(err, ret) {
// 	// occupation time exceeded error will be returned here if job not completed in given time
// });

// // Specify max execution time - max amount of time allowed between acquiring the lock and completing execution
// var lock = new AsyncLock({maxExecutionTime: 3000});
// lock.acquire(key, fn, function(err, ret) {
// 	// execution time exceeded error will be returned here if job not completed in given time
// });

export type LockGetTimeoutCleanNodeParams = {
  imageTimeout?: number;
  builderTimeout?: number;
  containerTimeout?: number;
};
export function lockGetTimeoutCleanNode(params?: LockGetTimeoutCleanNodeParams) {
  let imageTimeout = 0;
  let builderTimeout = 0;
  let containerTimeout = 0;

  if (params) {
    if (typeof params.imageTimeout === 'number') {
      imageTimeout = params.imageTimeout;
    }
    if (typeof params.builderTimeout === 'number') {
      builderTimeout = params.builderTimeout;
    }
    if (typeof params.containerTimeout === 'number') {
      containerTimeout = params.containerTimeout;
    }
  }

  const maxExecutionTime = imageTimeout + builderTimeout + containerTimeout + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
  const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
  return {
    maxExecutionTime,
    maxOccupationTime,
  };
}

export type LockGetTimeoutCleanServiceParams = {
  execTimeout?: number;
};
export function lockGetTimeoutCleanService(params?: LockGetTimeoutCleanServiceParams) {
  let execTimeout = 0;

  if (params) {
    if (typeof params.execTimeout === 'number') {
      execTimeout = params.execTimeout;
    }
  }

  const maxExecutionTime = execTimeout + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
  const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
  return {
    maxExecutionTime,
    maxOccupationTime,
  };
}

export type LockGetTimeoutBackupServiceParams = {
  execTimeout?: number;
  stopTimeout?: number;
  volumeListUploadTimeout?: number;
  startTimeout?: number;
};
export function lockGetTimeoutBackupService(params?: LockGetTimeoutBackupServiceParams) {
  let execTimeout = 0;
  let stopTimeout = 0;
  let volumeListUploadTimeout = 0;
  let startTimeout = 0;

  if (params) {
    if (typeof params.execTimeout === 'number') {
      execTimeout = params.execTimeout;
    }
    if (typeof params.stopTimeout === 'number') {
      stopTimeout = params.stopTimeout;
    }
    if (typeof params.volumeListUploadTimeout === 'number') {
      volumeListUploadTimeout = params.volumeListUploadTimeout;
    }
    if (typeof params.startTimeout === 'number') {
      startTimeout = params.startTimeout;
    }
  }

  const maxExecutionTime =
    execTimeout + stopTimeout + volumeListUploadTimeout + startTimeout + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
  const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
  return {
    maxExecutionTime,
    maxOccupationTime,
  };
}

export type LockGetTimeoutUpdateServiceParams = {
  updateTimeout?: number;
};
export function lockGetTimeoutUpdateService(params?: LockGetTimeoutUpdateServiceParams) {
  let updateTimeout = 0;

  if (params) {
    if (typeof params.updateTimeout === 'number') {
      updateTimeout = params.updateTimeout;
    }
  }

  const maxExecutionTime = updateTimeout + getProcessEnv().SWARM_UTILS_EXTRA_TIMEOUT;
  const maxOccupationTime = getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT + maxExecutionTime;
  return {
    maxExecutionTime,
    maxOccupationTime,
  };
}
