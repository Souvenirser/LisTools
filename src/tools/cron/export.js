export function exportCron(result, format) {
  if(format==='json') return JSON.stringify({
    expression:result.parsed.expression, dialect:result.parsed.dialect, timeZone:result.timeZone,
    reference:result.reference, dates:result.dates.map(({localTime,offset,utcTime,isoTime})=>({localTime,offset,utcTime,isoTime}))
  },null,2);
  const quote=value=>/[",\r\n]/.test(String(value)) ? `"${String(value).replaceAll('"','""')}"` : String(value);
  return [['index','localTime','offset','timeZone','utcTime'],...result.dates.map((date,index)=>[index+1,date.localTime,date.offset,result.timeZone,date.utcTime])].map(row=>row.map(quote).join(',')).join('\r\n');
}
