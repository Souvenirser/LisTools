import { Temporal } from 'temporal-polyfill/implementation';
const fail=code=>{throw Object.assign(new RangeError(code),{code:`dates.${code}`,params:{}});};
function date(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) fail('invalidDate');
  try { return Temporal.PlainDate.from(value,{overflow:'reject'}); } catch { fail('invalidDate'); }
}
export function difference(start,end,inclusive=false) {
  const a=date(start),b=date(end),direction=Temporal.PlainDate.compare(a,b)>0?-1:1;
  const adjusted=inclusive?b.add({days:direction}):b;
  const duration=a.until(adjusted,{largestUnit:'years'}),days=a.until(adjusted,{largestUnit:'days'}).days;
  return {days,weeks:Math.trunc(days/7),remainingDays:days%7,years:duration.years,months:duration.months,calendarDays:duration.days};
}
export function shiftDate(start,amount,unit) {
  if(String(amount).trim()===''||!['days','weeks','months','years'].includes(unit)||!Number.isSafeInteger(Number(amount))||Math.abs(Number(amount))>1000000) fail('invalidAmount');
  try {return date(start).add({[unit]:Number(amount)},{overflow:'constrain'}).toString();} catch(error) {if(error.code)throw error;fail('outOfRange');}
}
export function parseDateList(value) {return String(value).split(/[\s,;]+/).filter(Boolean).map(value=>date(value).toString());}
export function businessDays(start,end,{off=[],work=[],inclusive=false}={}) {
  let a=date(start),b=date(end),sign=1;
  if(Temporal.PlainDate.compare(a,b)>0){[a,b]=[b,a];sign=-1;}
  const count=a.until(b,{largestUnit:'days'}).days+(inclusive?1:0);
  if(count>366000) fail('rangeTooLarge');
  const holidays=new Set(off.map(value=>date(value).toString())),overrides=new Set(work.map(value=>date(value).toString()));
  let total=0;
  for(let i=0;i<count;i++,a=a.add({days:1})) {const key=a.toString();if(overrides.has(key)||(!holidays.has(key)&&a.dayOfWeek<=5))total++;}
  return sign*total;
}
export function dateMilestone(origin,reference) {
  const a=date(origin),b=date(reference);
  if(Temporal.PlainDate.compare(a,b)>0) fail('futureOrigin');
  const anniversary=a.with({year:b.year},{overflow:'constrain'});
  const years=b.year-a.year-(Temporal.PlainDate.compare(anniversary,b)>0?1:0);
  let next=anniversary;
  if(Temporal.PlainDate.compare(next,b)<0) next=a.with({year:b.year+1},{overflow:'constrain'});
  return {years,next:next.toString(),days:b.until(next,{largestUnit:'days'}).days};
}
