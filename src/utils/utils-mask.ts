export type MaskItem = {
  str: string; // -e AWS_SECRET_KEY=asdqwe123 / "someProp":"ASDzxc123"
  val: string; // asdqwe123 / ASDzxc123
};
export type MaskStringParams = {
  sourceStr: string;
  maskList?: MaskItem[];
};
export type MaskObjParams = {
  sourceObj: Record<string, any>;
  maskList?: MaskItem[];
  removeKeyList?: string[];
};

export function maskString(params: MaskStringParams) {
  let resultStr = params.sourceStr;
  if (params.maskList && params.maskList.length > 0) {
    for (const maskItem of params.maskList) {
      if (maskItem.str.length > 0 && maskItem.val.length > 0) {
        const replaceStr = maskItem.str.replace(maskItem.val, '*****');
        resultStr = resultStr.replace(maskItem.str, replaceStr);
      }
    }
  }
  return resultStr;
}
export function maskObj(params: MaskObjParams): Record<string, any> | any[] {
  let resultStr = JSON.stringify(params.sourceObj);
  if (params.removeKeyList && params.removeKeyList.length > 0) {
    const tmpObj = JSON.parse(resultStr);
    removeKeys(tmpObj, params.removeKeyList);
    resultStr = JSON.stringify(tmpObj);
  }
  if (params.maskList && params.maskList.length > 0) {
    resultStr = maskString({
      sourceStr: resultStr,
      maskList: params.maskList,
    });
  }
  return JSON.parse(resultStr);
}

// Функция для удаления ключей из JSON (объекта / массива)
function removeKeys(objOrArr: Record<string, any> | any[], keyList: string[]) {
  if (typeof objOrArr === 'object') {
    if (Array.isArray(objOrArr)) {
      for (const item of objOrArr) {
        removeKeys(item, keyList);
      }
    } else {
      for (const key of Object.keys(objOrArr)) {
        if (keyList.includes(key)) {
          delete objOrArr[key];
        } else {
          removeKeys(objOrArr[key], keyList);
        }
      }
    }
  }
}

//-----

// const regStr = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*".*?"\\s*,?\\s*`, 'g');
// resultStr = resultStr.replace(regStr, '');
// const regNum = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*-?\\d+(\\.\\d+)?\\s*,?\\s*`, 'g');
// resultStr = resultStr.replace(regNum, '');
// const regBool = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*(true|false)\\s*,?\\s*`, 'g');
// resultStr = resultStr.replace(regBool, '');
// const regNull = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*null\\s*,?\\s*`, 'g');
// resultStr = resultStr.replace(regNull, '');
// const regObj = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*\\{[^}]*\\},?\\s*`, 'g');
// resultStr = resultStr.replace(regObj, '');
// const regArr = new RegExp(`"${maskItem.removeKey}"\\s*:\\s*\\[[^\\]]*\\],?\\s*`, 'g');
// resultStr = resultStr.replace(regArr, '');

// const regComma = new RegExp(`,\\s*(?=[}\\]])`, 'g');
