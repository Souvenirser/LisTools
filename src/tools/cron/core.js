import { Cron } from 'croner';
import { Temporal } from 'temporal-polyfill/implementation';
import { getDeviceTimeZone, timeToTimestamp, timestampToTime } from '../timestamp/core.js';

const definitions = {
  second:{ id:'second', zh:'秒', en:'Second', min:0, max:59 },
  minute:{ id:'minute', zh:'分', en:'Minute', min:0, max:59 },
  hour:{ id:'hour', zh:'时', en:'Hour', min:0, max:23 },
  day:{ id:'day', zh:'日期', en:'Day of month', min:1, max:31 },
  month:{ id:'month', zh:'月', en:'Month', min:1, max:12 },
  weekday:{ id:'weekday', zh:'星期', en:'Day of week', min:0, max:7 },
  year:{ id:'year', zh:'年', en:'Year', min:1970, max:2099 }
};
const aliases = { '@yearly':'0 0 1 1 *', '@annually':'0 0 1 1 *', '@monthly':'0 0 1 * *', '@weekly':'0 0 * * 0', '@daily':'0 0 * * *', '@midnight':'0 0 * * *', '@hourly':'0 * * * *' };
const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const weekdays = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function fail(field, code, message, messageEn) { throw Object.assign(new RangeError(message), { field, code, messageEn }); }
function fieldError(field) {
  fail(field.id,'field',`${field.zh}字段“${field.value}”无效。范围为 ${field.min}–${field.max}；请检查列表、范围和步长语法。`,`${field.en} field “${field.value}” is invalid. Allowed range: ${field.min}–${field.max}; check list, range and step syntax.`);
}
function number(value, field, quartz) {
  let n;
  if (/^\d+$/.test(value)) n=Number(value);
  else if (field.id==='month' && months.includes(value)) n=months.indexOf(value)+1;
  else if (field.id==='weekday' && weekdays.includes(value)) n=weekdays.indexOf(value)+(quartz ? 1 : 0);
  if (!Number.isInteger(n) || n<field.min || n>field.max) fieldError(field);
  return n;
}
function validateBasic(value, field, quartz=false) {
  for(const component of value.split(',')) {
    const parts=component.split('/');
    if(parts.length>2 || !parts[0]) fieldError(field);
    if(parts.length===2 && (!/^\d+$/.test(parts[1]) || Number(parts[1])<1 || Number(parts[1])>field.max-field.min+1)) fieldError(field);
    if(parts[0]==='*') continue;
    const range=parts[0].split('-');
    if(range.length>2 || !range[0]) fieldError(field);
    const first=number(range[0],field,quartz);
    if(range.length===2 && number(range[1],field,quartz)<first) fieldError(field);
  }
}
function normalizeField(field, quartz) {
  const value=field.value;
  if(quartz && ['day','weekday'].includes(field.id)) {
    if(value==='?') return '*';
    if(field.id==='day') {
      if(value==='L' || value==='LW') return value;
      const offset=/^L-(\d+)$/.exec(value);
      if(offset) { if(Number(offset[1])>30) fieldError(field); return '*'; }
      const nearest=/^(\d+)W$/.exec(value);
      if(nearest) { number(nearest[1],field,quartz); return value; }
    } else {
      if(value==='L') return '7';
      const last=/^(\d+|[A-Z]{3})L$/.exec(value);
      if(last) { number(last[1],field,quartz); return `${last[1]}#L`; }
      const nth=/^(\d+|[A-Z]{3})#([1-5])$/.exec(value);
      if(nth) { number(nth[1],field,quartz); return value; }
    }
  }
  validateBasic(value,field,quartz);
  return value;
}

export function parseCron(expression, dialect='linux') {
  if(!['linux','seconds','quartz'].includes(dialect)) fail('dialect','dialect','请选择 Linux、含秒或 Quartz 方言。','Choose Linux, seconds or Quartz syntax.');
  const original=String(expression).trim();
  if(!original) fail('expression','empty','请输入 Cron 表达式。','Enter a Cron expression.');
  if(original.length>1024) fail('expression','inputLimit','Cron 表达式不能超过 1024 个字符。','Cron expressions must not exceed 1024 characters.');
  if(original.toLowerCase()==='@reboot') fail('expression','reboot','@reboot 取决于系统启动，无法计算下次执行时间。','@reboot depends on a system restart and has no calculable next date.');
  let source=original;
  if(source.startsWith('@')) {
    if(dialect!=='linux' || !aliases[source.toLowerCase()]) fail('expression','alias','仅 Linux 支持 @hourly、@daily、@weekly、@monthly 和 @yearly 等预设。','Aliases such as @hourly, @daily, @weekly, @monthly and @yearly are supported only in Linux mode.');
    source=aliases[source.toLowerCase()];
  }
  const values=source.toUpperCase().split(/\s+/);
  const quartz=dialect==='quartz';
  if((dialect==='linux' && values.length!==5) || (dialect==='seconds' && values.length!==6) || (quartz && ![6,7].includes(values.length))) {
    fail('expression','fieldCount',`当前方言需要 ${quartz ? '6 或 7' : dialect==='linux' ? '5' : '6'} 个字段，实际为 ${values.length} 个。`,`This syntax requires ${quartz ? '6 or 7' : dialect==='linux' ? '5' : '6'} fields; received ${values.length}.`);
  }
  const ids=dialect==='linux' ? ['minute','hour','day','month','weekday'] : ['second','minute','hour','day','month','weekday',...(values.length===7 ? ['year'] : [])];
  const fields=ids.map((id,index)=>({...definitions[id],...(quartz && id==='weekday' ? {min:1} : {}),value:values[index]}));
  const normalized=fields.map(field=>normalizeField(field,quartz));
  const day=fields.find(field=>field.id==='day'), weekday=fields.find(field=>field.id==='weekday');
  if(quartz && (Number(day.value==='?')+Number(weekday.value==='?')!==1)) {
    fail('day','questionMark','Quartz 的日期和星期必须恰好有一个字段为 ?。','Quartz requires exactly one ? in either day of month or day of week.');
  }
  return { expression:original, dialect, fields, normalizedExpression:normalized.join(' '), dayOffset:quartz && /^L-\d+$/.test(day.value) ? Number(day.value.slice(2)) : null };
}

export function evaluateCron(expression, { dialect='linux', timeZone=getDeviceTimeZone().timeZone, reference='', count=10 }={}) {
  let job;
  try {
    const parsed=parseCron(expression,dialect);
    if(!Number.isInteger(Number(count)) || Number(count)<1 || Number(count)>100) fail('count','count','执行次数必须为 1–100 的整数。','The date count must be an integer between 1 and 100.');
    const start=reference ? timeToTimestamp(reference,timeZone) : timestampToTime(String(Date.now()),'milliseconds',timeZone);
    if(start.status!=='ready') fail(start.code==='timestamp.invalidZone' ? 'timeZone' : 'reference',start.code,start.message,'Invalid reference time or timezone. Use a valid IANA timezone and YYYY-MM-DD HH:mm:ss; add Z or an explicit UTC offset for ambiguous local times.');
    job=new Cron(parsed.normalizedExpression,{ paused:true, timezone:timeZone, mode:dialect==='linux' ? '5-part' : parsed.fields.length===7 ? '7-part' : '6-part', domAndDow:dialect==='quartz', alternativeWeekdays:dialect==='quartz' });
    let cursor=new Date(Number(start.milliseconds));
    if(dialect==='quartz') {
      const firstYear=Temporal.PlainDateTime.from('1970-01-01T00:00:00').toZonedDateTime(timeZone).epochMilliseconds;
      cursor=new Date(Math.max(cursor.getTime(),firstYear-1000));
    }
    const dates=[];
    while(dates.length<Number(count)) {
      let next=job.nextRun(cursor);
      if(!next) break;
      if(next.getTime()<=cursor.getTime()) {
        const wallTime=Temporal.Instant.fromEpochMilliseconds(next.getTime()).toZonedDateTimeISO(timeZone).toPlainDateTime();
        next=new Date(wallTime.toZonedDateTime(timeZone,{disambiguation:'later'}).epochMilliseconds);
        if(next.getTime()<=cursor.getTime()) throw new RangeError('Cron did not advance');
      }
      cursor=next;
      const instant=Temporal.Instant.fromEpochMilliseconds(next.getTime());
      const local=instant.toZonedDateTimeISO(timeZone);
      if(dialect==='quartz' && local.year>2099) break;
      // Croner shifts a missing DST wall time forward; only retain actual pattern matches.
      if(!job.match(next)) continue;
      if(parsed.dayOffset!==null && local.day!==local.daysInMonth-parsed.dayOffset) {
        const target=local.daysInMonth-parsed.dayOffset;
        const nextDay=target>=1 && local.day<target ? local.toPlainDate().with({day:target}) : local.toPlainDate().with({day:1}).add({months:1});
        cursor=new Date(nextDay.toPlainDateTime().toZonedDateTime(timeZone).epochMilliseconds-1000);
        continue;
      }
      // Normalize overlaps with the timezone's actual transition size, including half-hour changes.
      const milliseconds=local.toPlainDateTime().toZonedDateTime(timeZone,{disambiguation:'earlier'}).epochMilliseconds;
      if(milliseconds<=Number(start.milliseconds) || (dates.length && milliseconds<=Number(dates.at(-1).milliseconds))) continue;
      dates.push(timestampToTime(String(milliseconds),'milliseconds',timeZone));
    }
    return { status:'ready', parsed, dates, timeZone, reference:start.isoTime, count:Number(count), exhausted:dates.length<Number(count) };
  } catch(error) {
    return { status:'error', field:error.field || 'expression', code:error.code || 'invalid', message:error.message, messageEn:error.messageEn || 'Unable to calculate this expression. Check its fields and reference time.' };
  } finally { job?.stop(); }
}

export function buildCronField(mode, values={}, field) {
  let token;
  if(mode==='every') token='*';
  else if(mode==='list') token=values.values.trim();
  else if(mode==='range') token=`${values.start}-${values.end}`;
  else if(mode==='step') token=`${values.start || '*'}/${values.step}`;
  else fieldError(field);
  validateBasic(token,{...field,value:token},field.id==='weekday' && field.min===1);
  return token;
}
