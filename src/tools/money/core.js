import Decimal from 'decimal.js';
import nzh from 'nzh';
const fail=()=>{throw Object.assign(new RangeError('money.invalidAmount'),{code:'money.invalidAmount',params:{}});};
export function formatMoney(input) {
  const original=String(input).trim(),normalized=original.replace(/^([-+]?)\./,'$10.');
  if(original.length>1000||!/^[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) fail();
  const raw=normalized.replaceAll(',',''),value=new Decimal(raw),roundedValue=value.toDecimalPlaces(2,Decimal.ROUND_HALF_UP);
  const rounded=roundedValue.isZero()?'0.00':roundedValue.toFixed(2);
  const [integer,fraction]=rounded.split('.');
  return {original,rounded,grouped:`${integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${fraction}`,didRound:!value.eq(roundedValue),simplified:nzh.cn.toMoney(rounded,{outSymbol:false,forceZheng:true,unOmitYuan:true}),traditional:nzh.hk.toMoney(rounded,{outSymbol:false,forceZheng:true,unOmitYuan:true})};
}
