const loadNs = process.hrtime();
const loadMsBigInt = BigInt(new Date().getTime()) * BigInt(1e6);

const nanoseconds = () => {
  const diffNs = process.hrtime(loadNs);
  const addBigInt = BigInt(diffNs[0]) * BigInt(1e9) + BigInt(diffNs[1]);
  return (loadMsBigInt + addBigInt).toString();
};

type LogFormat = {
  timestamp: string;
  level: string;
  message: string;
  errorName?: string;
  errorMessage?: string;
  errorTrace?: string;
  logExtra?: Record<string, any>; //Extra данные для лога
  errorExtra?: Record<string, any>; //Extra данные для ошибки
  errorExtraKeys?: Record<string, any>; //ErrorExtraKeys - дополнительные ключи ошибки
};

function printLog(level: string, message: string, extrasArr: any[]) {
  const nanoString = nanoseconds();
  const msNumber = Number(nanoString.substring(0, nanoString.length - 6));
  //format = 2024-04-27T18:34:45.249230292Z
  const timestamp = `${new Date(msNumber).toISOString().slice(0, -1)}${nanoString.substring(nanoString.length - 6)}Z`;

  let newInfo: LogFormat = {
    timestamp,
    level: level,
    message: message,
  };

  //Формат лога (msg, [error, obj]) или (msg, [obj])
  //info['0'] - error/obj, info['1'] - obj
  for (const el of extrasArr) {
    if (el instanceof Error) {
      //Нашли инстанс ошибки
      if (typeof el.message === 'string' && el.message.length > 0) {
        //Если есть сообщение
        newInfo.message = `${newInfo.message.replace(el.message, '')}`.trim();
        newInfo['errorMessage'] = el.message;
      }

      // У ошибки есть название
      if (typeof el.name === 'string' && el.name.length > 0) {
        newInfo['errorName'] = el.name;
      }

      //Проверка есть ли у ошибки ТРЕЙС
      if (typeof el.stack === 'string' && el.stack.length > 0) {
        const tmp = el.stack.split('\n').map((el1) => el1.trim());
        newInfo['errorTrace'] = tmp
          .slice(1, tmp.length - 1) // Убрать Error: NOT_CORRECT_QUERY;
          .filter((el1) => !el1.includes('node_modules') && !el1.includes('node:internal'))
          .join('; ');
      }

      //Если в ошибке есть ExtraData
      const elAny = el as any;

      if (!isEmptyObj(elAny.extraData)) {
        newInfo['errorExtra'] = elAny.extraData;
      }

      const elExtraKeys: Record<string, any> = {};
      for (const elAnyKey of Object.keys(elAny)) {
        if (['message', 'name', 'stack', 'extraData'].indexOf(elAnyKey) === -1) {
          elExtraKeys[elAnyKey] = elAny[elAnyKey];
        }
      }

      // МБ в сущности ошибки - больше не осталось ключей
      if (!isEmptyObj(elExtraKeys)) {
        // Добавление extra ключей
        newInfo['errorExtraKeys'] = elExtraKeys;
      }
    } else {
      //Все остальное
      if (!isEmptyObj(el)) {
        newInfo['logExtra'] = el;
      }
    }
  }

  console.log(JSON.stringify(newInfo, circularReplacer()));
}

const isEmptyObj = (obj: any) => {
  if (typeof obj !== 'object') return true; // Это не объект
  if (Array.isArray(obj)) return true; // Это массив typeof [] = 'object'
  for (let _ in obj) return false;
  return true;
};

const circularReplacer = () => {
  const seen = new WeakSet();
  return (_key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  };
};

export function logInfo(message: string, meta: Record<string, any> = {}) {
  printLog('info', message, [meta]);
}

export function logWarn(message: string, meta: Record<string, any> = {}) {
  printLog('warn', message, [meta]);
}

//Под вопросом на счет ANY
export function logError(message: string, err: any, meta: Record<string, any> = {}) {
  printLog('error', message, [err, meta]);
}
