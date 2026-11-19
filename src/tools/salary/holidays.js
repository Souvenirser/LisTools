// holiday-cn (MIT), bundled offline; provenance and hashes in data/NOTICE.md.
import data2025 from './data/2025.json' with {type:'json'};
import data2026 from './data/2026.json' with {type:'json'};
import data2027 from './data/2027.json' with {type:'json'};
const data=[data2025,data2026,data2027];
const versions={2025:'2026.01.01',2026:'2026.01.01',2027:'2026.11.05'};
export function monthHolidays(month){
 const year=Number(month.slice(0,4)),current=data.find(item=>item.year===year),available=Boolean(current?.papers.length&&current.days.length);
 // A following year's announcement can include dates in this December.
 const applicable=data.filter(item=>item.year===year||item.year===year+1),days=new Map();
 for(const item of applicable)for(const day of item.days)if(day.date.startsWith(month+'-'))days.set(day.date,day);
 return {year,available,version:versions[year],days:[...days.values()],papers:[...new Set(applicable.flatMap(item=>item.papers))]};
}
export function applyHolidaySchedule(config){
 const month=monthHolidays(config.month);if(!month.available)throw Object.assign(new RangeError('Holiday data unavailable'),{code:'salary.holidaysUnavailable',field:'salary-calendar'});
 const result={...config,offDays:[...config.offDays],overrides:{...config.overrides}};
 if(config.mode==='monthly'){
  const off=new Set(config.offDays);for(const day of month.days)if(day.isOffDay)off.add(day.date);else off.delete(day.date);result.offDays=[...off].sort();
 }else for(const day of month.days)result.overrides[day.date]=day.isOffDay?'rest':'work';
 return result;
}
