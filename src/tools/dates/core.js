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
  const a=date(start),b=date(end),sign=Temporal.PlainDate.compare(a,b)>0?-1:1;
  const count=Math.abs(a.until(b,{largestUnit:'days'}).days)+(inclusive?1:0);
  if(count>366000) fail('rangeTooLarge');
  const holidays=new Set(off.map(value=>date(value).toString())),overrides=new Set(work.map(value=>date(value).toString()));
  const first=sign>0?a:b.add({days:inclusive?0:1});
  const last=first.add({days:count});
  let total=Math.floor(count/7)*5;
  for(let i=0;i<count%7;i++)if(first.add({days:i}).dayOfWeek<=5)total++;
  for(const key of new Set([...holidays,...overrides])){
    const day=date(key);
    if(Temporal.PlainDate.compare(day,first)<0||Temporal.PlainDate.compare(day,last)>=0)continue;
    const normal=day.dayOfWeek<=5,actual=overrides.has(key)||(!holidays.has(key)&&normal);
    total+=Number(actual)-Number(normal);
  }
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
