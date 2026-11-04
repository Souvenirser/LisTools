import Decimal from 'decimal.js';

// Isolate payroll precision from the calculator and other consumers.
export const D=Decimal.clone({precision:80,rounding:Decimal.ROUND_HALF_UP});
export function fail(code,field,params={}){throw Object.assign(new RangeError(code),{code,field,params});}
export function amount(value,field='amount',fallback){
 if((value===undefined||value===null||String(value).trim()==='')&&fallback!==undefined)return new D(fallback);
 const text=String(value??'').trim().replace(/^\+/,'').replace(/^\./,'0.');
 if(!/^(?:\d{1,15}|\d{1,3}(?:,\d{3}){1,4})(?:\.\d{1,2})?$/.test(text))fail('payroll.amount',field);
 return new D(text.replaceAll(',',''));
}
export const fixed=value=>new D(value).toFixed(2);
export const sum=values=>values.reduce((total,value)=>total.plus(value),new D(0));
export function rate(value,field){let x;try{x=new D(value);}catch{fail('insurance.rateRange',field);}if(!x.isFinite()||x.lt(0)||x.gt(1))fail('insurance.rateRange',field);return x;}
export function percent(value,field){if(!/^\d+(?:\.\d{1,6})?$/.test(String(value)))fail('insurance.rateRange',field);return rate(new D(value).div(100),field).toString();}
export function monthParts(value){if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)||Number(value.slice(0,4))<2026)fail('insurance.month','month');return {year:Number(value.slice(0,4)),month:Number(value.slice(5))};}
