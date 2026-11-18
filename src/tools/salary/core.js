// Schedule-overrides and month-hour apportionment adapted from salary-clock (MIT).
// Upstream 47009d018d5489025743c98bc49752ab8eb42045; see NOTICE.md and LICENSE.
import {Temporal} from 'temporal-polyfill/implementation';
import Decimal from 'decimal.js';
const D=Decimal.clone({precision:80,rounding:Decimal.ROUND_DOWN});
const fail=(key,field)=>{throw Object.assign(new RangeError(key),{code:'salary.'+key,field:field&&'salary-'+field});};
const plainDate=value=>{try{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error();return Temporal.PlainDate.from(value,{overflow:'reject'});}catch{fail('invalidDate','anchor');}};
function firstDay(month){try{if(!/^\d{4}-\d{2}$/.test(month))throw Error();return plainDate(month+'-01');}catch{fail('invalidDate','calendar');}}
export function monthAt(now,timeZone){return Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timeZone).toPlainDate().toString().slice(0,7);}
export function defaultConfig(now=Date.now(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
 const month=monthAt(now,timeZone),today=Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(timeZone).toPlainDate(),first=firstDay(month);
 let weekends=0;for(let day=1;day<=first.daysInMonth;day++)if(first.with({day}).dayOfWeek>5)weekends++;
 return {version:1,salary:'',hours:'8',start:'09:00',lunchStart:'12:00',lunchMinutes:60,timeZone,mode:'cycle',workDays:5,restDays:2,anchor:today.subtract({days:today.dayOfWeek-1}).toString(),month,monthlyRestDays:weekends,offDays:[],overrides:{},showBar:false,masked:false,enabled:false};
}
function minute(value,field){if(!/^\d{2}:\d{2}$/.test(value))fail('invalidTime',field);const [h,m]=value.split(':').map(Number);if(h>23||m>59)fail('invalidTime',field);return h*60+m;}
export function shiftTimes(config){
 const start=minute(config.start,'start');let paid;
 try{const hours=new D(config.hours);paid=hours.mul(60);if(!hours.isFinite()||hours.lte(0)||hours.gt(24)||!paid.isInteger())throw Error();}catch{fail('invalidHours','hours');}
 const lunch=Number(config.lunchMinutes);if(!Number.isSafeInteger(lunch)||lunch<0||lunch>=1440)fail('invalidLunch','lunch-minutes');
 const end=start+paid.toNumber()+lunch;if(end>1440)fail('overnight','hours');
 const lunchStart=lunch?minute(config.lunchStart,'lunch-start'):start;
 if(lunch&&(lunchStart<start||lunchStart+lunch>end))fail('invalidLunch','lunch-start');
 return {startMinutes:start,endMinutes:end,lunchStartMinutes:lunchStart,lunchEndMinutes:lunchStart+lunch,lunchMinutes:lunch};
}
export function calendarDays(config,month){
 const first=firstDay(month);if(!['cycle','monthly'].includes(config.mode))fail('invalidCycle','mode');
 const work=Number(config.workDays),rest=Number(config.restDays);
 if(config.mode==='cycle'&&(!Number.isSafeInteger(work)||work<1||!Number.isSafeInteger(rest)||rest<0||!Number.isSafeInteger(work+rest)))fail('invalidCycle','work-days');
 const anchor=config.mode==='cycle'?plainDate(config.anchor):first,off=new Set(config.offDays||[]),current=config.month===month;
 return Array.from({length:first.daysInMonth},(_,index)=>{
  const date=first.with({day:index+1}),name=date.toString(),distance=anchor.until(date,{largestUnit:'days'}).days,phase=((distance%(work+rest))+(work+rest))%(work+rest);
  const baseWork=config.mode==='cycle'?phase<work:!off.has(name),override=current&&config.mode==='cycle'?config.overrides?.[name]:undefined;
  return {date:name,day:index+1,weekday:date.dayOfWeek,work:override?override==='work':baseWork,baseWork,overridden:Boolean(override)};
 });
}
function instant(date,minutes,timeZone){
 try{const day=plainDate(date).add({days:minutes===1440?1:0}),value=minutes%1440;return day.toPlainDateTime({hour:Math.floor(value/60),minute:value%60}).toZonedDateTime(timeZone,{disambiguation:'reject'}).epochMilliseconds;}catch{fail('ambiguousTime','start');}
}
export function buildMonthPlan(config,now=Date.now()){
 const month=monthAt(now,config.timeZone);
 if(config.mode==='monthly'&&config.month!==month)return {month,state:'pending',config};
 const times=shiftTimes(config),days=calendarDays(config,month),intervals=[];
 for(const day of days.filter(day=>day.work)){
  const ranges=times.lunchMinutes?[[times.startMinutes,times.lunchStartMinutes],[times.lunchEndMinutes,times.endMinutes]]:[[times.startMinutes,times.endMinutes]];
  for(const [start,end]of ranges)if(end>start){const from=instant(day.date,start,config.timeZone),to=instant(day.date,end,config.timeZone);if(to<=from)fail('ambiguousTime','start');intervals.push({from,to,date:day.date});}
 }
 const totalMs=intervals.reduce((sum,range)=>sum+range.to-range.from,0);if(!totalMs)fail('noWork','calendar');
 return {month,config,days,intervals,totalMs,workDays:days.filter(day=>day.work).length,restDays:days.filter(day=>!day.work).length,...times};
}
export function normalizeConfig(raw){
 if(!raw||raw.version!==1)fail('invalidConfig');
 const salary=String(raw.salary??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(salary)||salary.length>64||new D(salary).lte(0))fail('invalidSalary','amount');
 const month=String(raw.month),first=firstDay(month),timeZone=String(raw.timeZone);
 try{Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timeZone);}catch{fail('invalidTimeZone');}
 const config={version:1,salary,hours:String(raw.hours),start:String(raw.start),lunchStart:String(raw.lunchStart),lunchMinutes:Number(raw.lunchMinutes),timeZone,mode:raw.mode,workDays:raw.mode==='monthly'?5:Number(raw.workDays),restDays:raw.mode==='monthly'?2:Number(raw.restDays),anchor:raw.mode==='monthly'?first.toString():String(raw.anchor),month,monthlyRestDays:Number(raw.monthlyRestDays),offDays:[],overrides:{},showBar:raw.showBar===true,masked:raw.masked===true,enabled:true};
 if(!Array.isArray(raw.offDays)||!raw.overrides||typeof raw.overrides!=='object'||Array.isArray(raw.overrides))fail('invalidConfig');
 for(const date of new Set(raw.offDays)){plainDate(date);if(!date.startsWith(month+'-'))fail('invalidDate','calendar');config.offDays.push(date);}
 for(const [date,value]of Object.entries(raw.overrides)){plainDate(date);if(!date.startsWith(month+'-')||!['work','rest'].includes(value))fail('invalidDate','calendar');config.overrides[date]=value;}
 if(config.mode==='monthly'){
  if(!Number.isSafeInteger(config.monthlyRestDays)||config.monthlyRestDays<0||config.monthlyRestDays>=first.daysInMonth)fail('invalidRest','monthly-rest');
  if(config.offDays.length!==config.monthlyRestDays)fail('restCount','calendar');
 }
 // Validate the confirmed month, including DST boundaries, without replacing it on restore.
 buildMonthPlan(config,instant(first.toString(),12*60,timeZone));return config;
}
const shown=value=>value.toFixed(4,D.ROUND_DOWN);
export function snapshot(config,now=Date.now(),cachedPlan){
 if(!config?.enabled)return {state:'unconfigured',earned:null,today:null};
 const month=monthAt(now,config.timeZone),plan=cachedPlan?.month===month&&cachedPlan.config===config?cachedPlan:buildMonthPlan(config,now);
 if(plan.state==='pending')return {state:'pending',month,earned:null,today:null,plan};
 const date=Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(config.timeZone).toPlainDate().toString(),today=plan.intervals.filter(range=>range.date===date);
 const elapsed=range=>Math.max(0,Math.min(now,range.to)-range.from),earnedMs=plan.intervals.reduce((sum,range)=>sum+elapsed(range),0),todayMs=today.reduce((sum,range)=>sum+elapsed(range),0),money=new D(config.salary);
 let state='rest';if(today.length){state=now<today[0].from?'before':now>=today.at(-1).to?'after':today.some(range=>now>=range.from&&now<range.to)?'working':'lunch';}
 return {state,month,date,earned:shown(money.mul(earnedMs).div(plan.totalMs)),today:shown(money.mul(todayMs).div(plan.totalMs)),hourly:shown(money.mul(3600000).div(plan.totalMs)),perMinute:shown(money.mul(60000).div(plan.totalMs)),perSecond:shown(money.mul(1000).div(plan.totalMs)),progress:earnedMs/plan.totalMs*100,workedMs:earnedMs,plan};
}
