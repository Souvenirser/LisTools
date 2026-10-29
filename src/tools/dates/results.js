import {difference,shiftDate,businessDays,dateMilestone,parseDateList} from './core.js';
import {timeToTimestamp} from '../timestamp/core.js';

// Keep the displayed calculation and every export tied to the same input snapshot.
export function calculateDateResult(task,values){
 const input={...values};let value,dates;
 if(task==='shift'){
  value=shiftDate(input.base,input.amount,input.unit);dates=[{key:'result',date:value}];
 }else if(task==='milestone'){
  value=dateMilestone(input.origin,input.reference);dates=[{key:'next',date:value.next}];
 }else{
  value=task==='difference'?difference(input.start,input.end,input.inclusive):businessDays(input.start,input.end,{inclusive:input.inclusive,off:parseDateList(input.off),work:parseDateList(input.work)});
  dates=[{key:'start',date:input.start},{key:'end',date:input.end}];
 }
 return {task,input,value,dates};
}

export function dateTimestamp(date,time,timeZone){
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(time))return {status:'error',code:'dates.invalidTime'};
 return timeToTimestamp(`${date} ${time.length===5?time+':00':time}`,timeZone);
}
