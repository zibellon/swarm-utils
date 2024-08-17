import AsyncLock from 'async-lock';
import { getProcessEnv } from './utils-env-config';

export const resourceLock = new AsyncLock({
  timeout: getProcessEnv().SWARM_UTILS_LOCK_TIMEOUT,
  maxExecutionTime: getProcessEnv().SWARM_UTILS_LOCK_MAX_EXECUTION_TIME,
  maxOccupationTime: getProcessEnv().SWARM_UTILS_LOCK_MAX_OCCUPATION_TIME,
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
