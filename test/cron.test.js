import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, evaluateCron, buildCronField } from '../src/tools/cron/core.js';

const run = (expression, options = {}) => evaluateCron(expression, { dialect:'linux', timeZone:'UTC', reference:'2026-01-01T00:00:00Z', count:10, ...options });
const utc = result => result.dates.map(date => date.utcTime);

test('Cron field count is explicit for Linux, seconds and Quartz', () => {
  assert.equal(parseCron('*/5 * * * *','linux').fields.length,5);
  assert.equal(parseCron('0 */5 * * * *','seconds').fields.length,6);
  assert.equal(parseCron('0 0 9 ? * MON','quartz').fields.length,6);
  assert.equal(parseCron('0 0 9 ? * MON 2027','quartz').fields.length,7);
  for(const [expression,dialect] of [['0 * * * * *','linux'],['* * * * *','seconds'],['* * * * *','quartz'],['* * * * *','unknown']]) {
    assert.throws(()=>parseCron(expression,dialect));
  }
});

test('strict field grammar reports the invalid field and rejects ranges or extensions outside the dialect', () => {
  for(const [expression,dialect,field] of [
    ['60 * * * *','linux','minute'], ['0 24 * * *','linux','hour'], ['0 0 0 * *','linux','day'],
    ['0 0 * 13 *','linux','month'],['0 0 * * 8','linux','weekday'],['*/0 * * * *','linux','minute'],
    ['1,,2 * * * *','linux','minute'],['20-10 * * * *','linux','minute'],['*/61 * * * *','linux','minute'],
    ['0 0 ? * *','linux','day'],['0 0 L * *','linux','day'],['0 0 * * MON#2','linux','weekday'],
    ['0 0 * * +MON','linux','weekday'],['0 0 0 L * *','seconds','day'],
    ['0 0 9 ? * 0','quartz','weekday'],['0 0 9 ? * MON 2100','quartz','year'],
    ['0 0 9 ? * MON 1969','quartz','year'],['0 0 9 L-3W * ?','quartz','day'],
    ['0 0 9 L,15 * ?','quartz','day'],['0 0 9 ? * 6#6','quartz','weekday'],
    ['0 0 9 ? * 6L,2','quartz','weekday'],['0 0 9 32W * ?','quartz','day']
  ]) assert.throws(()=>parseCron(expression,dialect), error=>error.field===field,expression);
  assert.equal(run('0 0 * JAN,MAR MON-FRI').status,'ready');
});

test('Linux aliases are allowed only in Linux and reboot explains why it has no next date', () => {
  assert.equal(parseCron('@hourly','linux').normalizedExpression,'0 * * * *');
  assert.throws(()=>parseCron('@daily','seconds'));
  const reboot=run('@reboot');
  assert.equal(reboot.status,'error'); assert.equal(reboot.code,'reboot');
});

test('Quartz requires exactly one unspecified day field and respects Quartz weekdays', () => {
  for(const expression of ['0 0 9 * * MON','0 0 9 ? * ?']) assert.throws(()=>parseCron(expression,'quartz'));
  assert.deepEqual(utc(run('0 0 9 ? * 1',{dialect:'quartz',count:2})),['2026-01-04T09:00:00.000Z','2026-01-11T09:00:00.000Z']);
  assert.deepEqual(utc(run('0 0 9 ? * L',{dialect:'quartz',count:1})),['2026-01-03T09:00:00.000Z']);
  assert.deepEqual(utc(run('0 0 9 ? * 7',{dialect:'quartz',count:1})),['2026-01-03T09:00:00.000Z']);
});

test('Linux day of month and weekday use OR when both are restricted', () => {
  assert.deepEqual(utc(run('0 9 15 * MON',{count:4})),[
    '2026-01-05T09:00:00.000Z','2026-01-12T09:00:00.000Z','2026-01-15T09:00:00.000Z','2026-01-19T09:00:00.000Z'
  ]);
  assert.deepEqual(utc(run('0 9 * * 7',{count:1})),['2026-01-04T09:00:00.000Z']);
});

test('seconds schedules are strictly after the reference and return requested count with offsets', () => {
  const result=run('*/10 * * * * *',{dialect:'seconds',timeZone:'Asia/Shanghai',reference:'2026-01-01T08:00:00+08:00',count:20});
  assert.equal(result.dates.length,20); assert.equal(result.dates[0].utcTime,'2026-01-01T00:00:10.000Z');
  assert.equal(result.dates[0].isoTime,'2026-01-01T08:00:10.000+08:00');
  assert.equal(result.dates[0].offset,'+08:00');
  assert.equal(run('* * * * *',{count:100}).dates.length,100);
});

test('Quartz supports last day, nearest weekday, last weekday, offset last day and weekday ordinal', () => {
  const options={dialect:'quartz',reference:'2026-02-01T00:00:00Z',count:2};
  for(const [expression,expected] of [
    ['0 0 9 L * ?',['2026-02-28T09:00:00.000Z','2026-03-31T09:00:00.000Z']],
    ['0 0 9 LW * ?',['2026-02-27T09:00:00.000Z','2026-03-31T09:00:00.000Z']],
    ['0 0 9 1W * ?',['2026-02-02T09:00:00.000Z','2026-03-02T09:00:00.000Z']],
    ['0 0 9 L-3 * ?',['2026-02-25T09:00:00.000Z','2026-03-28T09:00:00.000Z']],
    ['0 0 9 ? * 6L',['2026-02-27T09:00:00.000Z','2026-03-27T09:00:00.000Z']],
    ['0 0 9 ? * MON#2',['2026-02-09T09:00:00.000Z','2026-03-09T09:00:00.000Z']]
  ]) assert.deepEqual(utc(run(expression,options)),expected,expression);
});

test('Quartz year bounds and impossible calendars produce finite empty results', () => {
  const year=run('0 0 0 1 JAN ? 2027',{dialect:'quartz',count:10});
  assert.deepEqual(utc(year),['2027-01-01T00:00:00.000Z']); assert.equal(year.exhausted,true);
  assert.equal(run('0 0 0 31 FEB ?',{dialect:'quartz'}).dates.length,0);
  assert.equal(run('0 0 31 FEB *').dates.length,0);
  assert.deepEqual(utc(run('0 0 29 FEB *',{count:1})),['2028-02-29T00:00:00.000Z']);
});

test('reference parsing rejects invalid zones and ambiguous local times, accepts explicit offsets', () => {
  assert.equal(run('* * * * *',{timeZone:'Invalid/Zone'}).status,'error');
  const ambiguous=run('* * * * *',{timeZone:'America/New_York',reference:'2026-11-01 01:30:00'});
  assert.equal(ambiguous.status,'error'); assert.equal(ambiguous.field,'reference');
  assert.equal(run('* * * * *',{timeZone:'America/New_York',reference:'2026-11-01T01:30:00-04:00'}).status,'ready');
});

test('DST gaps are skipped and one-hour overlaps run only at the first occurrence', () => {
  assert.deepEqual(utc(run('30 2 * * *',{timeZone:'America/New_York',reference:'2026-03-08T00:00:00-05:00',count:2})),[
    '2026-03-09T06:30:00.000Z','2026-03-10T06:30:00.000Z'
  ]);
  assert.deepEqual(utc(run('30 1 * * *',{timeZone:'America/New_York',reference:'2026-11-01T00:00:00-04:00',count:2})),[
    '2026-11-01T05:30:00.000Z','2026-11-02T06:30:00.000Z'
  ]);
});

test('visual builder emits explicit every, list, range and step tokens with validation', () => {
  assert.equal(buildCronField('every',{}, {min:0,max:59}),'*');
  assert.equal(buildCronField('list',{values:'0,15,30,45'},{min:0,max:59}),'0,15,30,45');
  assert.equal(buildCronField('range',{start:'9',end:'17'},{min:0,max:23}),'9-17');
  assert.equal(buildCronField('step',{start:'0',step:'5'},{min:0,max:59}),'0/5');
  assert.throws(()=>buildCronField('range',{start:'17',end:'9'},{min:0,max:23}));
});

test('descriptions lazy-load Chinese locales and use Quartz weekday numbering', async () => {
  const {describeCron}=await import('../src/tools/cron/description.js');
  const parsed=parseCron('0 0 9 ? * 1','quartz');
  assert.match(await describeCron(parsed,'en'),/Sunday/);
  assert.match(await describeCron(parsed,'zh-Hans'),/星期日|星期天|周日/);
  assert.match(await describeCron(parsed,'zh-Hant'),/星期日|星期天|週日/);
  assert.match(await describeCron(parsed,'fr'),/dimanche/);
});

test('CSV and JSON exports carry the exact calculation context and all dates', async () => {
  const {exportCron}=await import('../src/tools/cron/export.js');
  const result=run('0 9 * * *',{count:2});
  const json=JSON.parse(exportCron(result,'json'));
  assert.equal(json.expression,'0 9 * * *'); assert.equal(json.timeZone,'UTC'); assert.equal(json.dates.length,2);
  assert.match(exportCron(result,'csv'),/localTime,offset,timeZone,utcTime/);
  assert.match(exportCron(result,'csv'),/2026-01-01 09:00:00.000,\+00:00,UTC,2026-01-01T09:00:00.000Z/);
});

test('Quartz wildcard years stay within 1970–2099, including historical reference times', () => {
  const result=run('* * * ? * *',{dialect:'quartz',timeZone:'Asia/Shanghai',reference:'1960-01-01T00:00:00Z',count:2});
  assert.equal(result.dates[0].isoTime,'1970-01-01T00:00:00.000+08:00');
  assert.equal(result.dates[1].isoTime,'1970-01-01T00:00:01.000+08:00');
});

test('input limits reject oversized patterns and invalid output counts before calculation', () => {
  assert.throws(()=>parseCron('1,'.repeat(600)+'1 * * * *','linux'),error=>error.code==='inputLimit');
  assert.equal(run('* * * * *',{count:3}).dates.length,3);
  for(const count of [0,-1,101,1.5]) assert.equal(run('* * * * *',{count}).status,'error');
});

test('Chinese descriptions for L-n state the exact day offset rather than a last-n-days range', async () => {
  const {describeCron}=await import('../src/tools/cron/description.js');
  const parsed=parseCron('0 0 9 L-3 * ?','quartz');
  assert.match(await describeCron(parsed,'zh-Hans'),/最后一天往前 3 天/);
  assert.match(await describeCron(parsed,'zh-Hant'),/最後一天往前 3 天/);
});

test('half-hour DST overlaps select the first occurrence and preserve strictly increasing instants', () => {
  const result=run('45 1 * * *',{timeZone:'Australia/Lord_Howe',reference:'2026-04-05T00:00:00+11:00',count:3});
  assert.deepEqual(result.dates.map(date=>date.isoTime),[
    '2026-04-05T01:45:00.000+11:00','2026-04-06T01:45:00.000+10:30','2026-04-07T01:45:00.000+10:30'
  ]);
  assert.ok(result.dates.every((date,index)=>index===0 || Number(date.milliseconds)>Number(result.dates[index-1].milliseconds)));
});

test('overlap normalization never reintroduces the first occurrence at or before the reference', () => {
  for(const reference of ['2026-04-05T01:45:00+11:00','2026-04-05T01:50:00+11:00','2026-04-05T01:40:00+10:30']) {
    const result=run('45 1 * * *',{timeZone:'Australia/Lord_Howe',reference,count:2});
    assert.equal(result.dates[0].isoTime,'2026-04-06T01:45:00.000+10:30',reference);
    assert.ok(result.dates.every(date=>Number(date.milliseconds)>Date.parse(reference)),reference);
  }
});

test('Quartz visual builder resolves weekday names using 1-based Quartz numbering', () => {
  const field=parseCron('0 0 9 ? * SUN','quartz').fields.find(field=>field.id==='weekday');
  assert.equal(buildCronField('list',{values:'SUN,MON'},field),'SUN,MON');
  assert.equal(buildCronField('range',{start:'SUN',end:'SAT'},field),'SUN-SAT');
});

test('reference times in the second overlap occurrence skip the expired first occurrence and keep later dates', () => {
  const daily=run('30 1 * * *',{timeZone:'America/New_York',reference:'2026-11-01T01:00:00-05:00',count:2});
  assert.equal(daily.status,'ready');
  assert.deepEqual(utc(daily),['2026-11-02T06:30:00.000Z','2026-11-03T06:30:00.000Z']);
  const minutes=run('*/15 * * * *',{timeZone:'America/New_York',reference:'2026-11-01T01:00:00-05:00',count:3});
  assert.equal(minutes.status,'ready');
  assert.deepEqual(utc(minutes),['2026-11-01T07:00:00.000Z','2026-11-01T07:15:00.000Z','2026-11-01T07:30:00.000Z']);
});

test('two-hour DST overlaps use the first occurrence without losing later same-day matches', () => {
  const daily=run('30 1 * * *',{timeZone:'Antarctica/Troll',reference:'2026-10-25T00:00:00+02:00',count:2});
  assert.deepEqual(utc(daily),['2026-10-24T23:30:00.000Z','2026-10-26T01:30:00.000Z']);
  const minutes=run('*/30 * * * *',{timeZone:'Antarctica/Troll',reference:'2026-10-25T01:00:00+00:00',count:3});
  assert.deepEqual(utc(minutes),['2026-10-25T03:00:00.000Z','2026-10-25T03:30:00.000Z','2026-10-25T04:00:00.000Z']);
});

test('Cron errors retain stable codes and interpolation parameters',()=>{
 const field=run('61 * * * *');assert.equal(field.code,'field');assert.deepEqual(field.params,{value:'61',min:0,max:59});
 const count=run('* * * *');assert.equal(count.code,'fieldCount');assert.deepEqual(count.params,{required:'5',actual:4});
});

test('Cron descriptions support Russian and signal localized fallback without English prose',async()=>{
 const {describeCron}=await import('../src/tools/cron/description.js');
 const parsed=parseCron('*/5 * * * *');
 assert.match(await describeCron(parsed,'ru'),/минут/);
 assert.equal(await describeCron(parsed,'hi'),null);
 assert.equal(await describeCron(parseCron('0 0 9 L-3 * ?','quartz'),'ru'),null);
});
