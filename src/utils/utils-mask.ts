export type MaskItem = {
  str: string; // -e AWS_SECRET_KEY=asdqwe123 / "someProp":"ASDzxc123"
  val: string; // asdqwe123 / ASDzxc123
};
export function maskString(sourceStr: string, maskList: MaskItem[]) {
  let resultStr = sourceStr;
  if (maskList.length > 0) {
    for (const maskItem of maskList) {
      if (maskItem.str.length > 0 && maskItem.val.length > 0) {
        const replaceStr = maskItem.str.replace(maskItem.val, '*****');
        resultStr = resultStr.replace(maskItem.str, replaceStr);
      }
    }
  }
  return resultStr;
}
export function maskObj(sourceObj: Record<string, any>, maskList: MaskItem[]) {
  let resultStr = JSON.stringify(sourceObj);
  resultStr = maskString(resultStr, maskList);
  return JSON.parse(resultStr);
}
