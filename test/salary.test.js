import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultConfig,normalizeConfig,calendarDays,buildMonthPlan,snapshot,monthAt} from '../src/tools/salary/core.js';
const at=value=>Date.parse(value+'+08:00');
const now=at('2026-11-02T10:00:00');
const config=changes=>normalizeConfig({...defaultConfig(now,'Asia/Shanghai'),salary:'16800',...changes});

test('an old or malformed display preference does not opt into the wage bar',()=>{
 for(const value of [undefined,false,'false','true',1])assert.equal(config({showBar:value}).showBar,false);
 assert.equal(config({showBar:true}).showBar,true);
});

test('salary backfills scheduled work and freezes over lunch, evenings and rest days',()=>{
 const c=config();
 for(const [time,earned,state] of [['2026-11-02T08:59:59','0.0000','before'],['2026-11-02T10:00:00','100.0000','working'],['2026-11-02T12:30:00','300.0000','lunch'],['2026-11-02T13:00:00','300.0000','working'],['2026-11-02T18:00:00','800.0000','after'],['2026-11-03T10:00:00','900.0000','working'],['2026-11-08T10:00:00','4000.0000','rest']]){
  const result=snapshot(c,at(time));assert.equal(result.earned,earned,time);assert.equal(result.state,state,time);
 }
 assert.equal(snapshot(c,now).today,'100.0000');assert.equal(snapshot(c,now).hourly,'100.0000');
});
test('a monthly salary is capped at the last shift and resets only in the next month',()=>{
 const c=config();assert.equal(snapshot(c,at('2026-11-30T18:00:00')).earned,'16800.0000');assert.equal(snapshot(c,at('2026-11-30T23:59:59')).earned,'16800.0000');assert.equal(snapshot(c,at('2026-12-01T00:00:00')).earned,'0.0000');
});
test('cycle phase continues across months and date exceptions do not shift the cycle',()=>{
 const c=config({workDays:2,restDays:1,anchor:'2026-10-31',overrides:{'2026-11-02':'work','2026-11-03':'rest'}}),days=calendarDays(c,'2026-11');
 assert.deepEqual(days.slice(0,5).map(d=>d.work),[true,true,false,true,false]);assert.equal(days[1].baseWork,false);assert.equal(days[2].baseWork,true);
});
test('fixed rest dates require an exact count and explicit month confirmation',()=>{
 assert.throws(()=>config({mode:'monthly',monthlyRestDays:2,offDays:['2026-11-01']}),{code:'salary.restCount'});
 const c=config({mode:'monthly',monthlyRestDays:2,offDays:['2026-11-01','2026-11-02']});assert.equal(snapshot(c,at('2026-12-01T00:00:00')).state,'pending');assert.equal(snapshot(c,at('2026-12-01T00:00:00')).earned,null);
});
test('short months and leap days use the confirmed calendar rather than a fixed month length',()=>{
 const raw={...defaultConfig(at('2028-02-01T00:00:00'),'Asia/Shanghai'),salary:'23200',mode:'monthly',monthlyRestDays:0,offDays:[]};
 const c=normalizeConfig(raw);assert.equal(buildMonthPlan(c,at('2028-02-29T18:00:00')).workDays,29);assert.equal(snapshot(c,at('2028-02-29T18:00:00')).earned,'23200.0000');
 assert.throws(()=>normalizeConfig({...raw,monthlyRestDays:29}),{code:'salary.invalidRest'});
});
test('settings, breaks and overnight spans are validated before enabling',()=>{
 for(const [changes,code]of [[{salary:''},'invalidSalary'],[{salary:'1.001'},'invalidSalary'],[{hours:'0'},'invalidHours'],[{start:'22:00',lunchMinutes:0},'overnight'],[{lunchStart:'08:00'},'invalidLunch'],[{workDays:0},'invalidCycle'],[{anchor:'2026-02-30'},'invalidDate']])assert.throws(()=>config(changes),{code:'salary.'+code});
});
test('an entirely resting calendar cannot divide by zero',()=>{
 const overrides=Object.fromEntries(calendarDays(config(),'2026-11').map(day=>[day.date,'rest']));assert.throws(()=>config({overrides}),{code:'salary.noWork'});
});
test('salary precision is derived from original inputs and never accumulated by refreshes',()=>{
 const c=config({salary:'0.01'}),a=snapshot(c,now);for(let i=0;i<20;i++)assert.deepEqual(snapshot(c,now),a);assert.equal(snapshot(c,at('2026-11-30T18:00:00')).earned,'0.0100');assert.equal(snapshot(c,at('2026-11-02T09:00:00')).earned,'0.0000');
});
test('system time and saved timezone select the month, not the rendering machine locale',()=>{
 assert.equal(monthAt(Date.parse('2026-10-31T16:00:00Z'),'Asia/Shanghai'),'2026-11');assert.equal(monthAt(Date.parse('2026-10-31T16:00:00Z'),'America/New_York'),'2026-10');
 const c=config();assert.equal(snapshot(c,at('2026-11-03T10:00:00')).earned,'900.0000');assert.equal(snapshot(c,now).earned,'100.0000');
});
test('DST ambiguous and missing work boundaries are rejected',()=>{
 for(const [date,start]of [['2026-11-01','01:30'],['2026-03-08','02:30']]){
  const t=Date.parse(date+'T12:00:00Z'),raw={...defaultConfig(t,'America/New_York'),salary:'1000',hours:'1',start,lunchMinutes:0,overrides:{[date]:'work'}};
  assert.throws(()=>normalizeConfig(raw),{code:'salary.ambiguousTime'});
 }
});
test('normalization only retains salary settings and accepts disabled unpaid breaks',()=>{
 const c=config({lunchMinutes:0,extraSecret:'synthetic-private-marker'});assert.equal(c.extraSecret,undefined);assert.equal(buildMonthPlan(c,now).endMinutes,17*60);assert.equal(snapshot(null,now).state,'unconfigured');
});
test('monthly schedules ignore inactive cycle-only draft fields',()=>{
 const raw={...defaultConfig(now,'Asia/Shanghai'),salary:'16800',mode:'monthly',monthlyRestDays:0,offDays:[],workDays:0,restDays:NaN,anchor:''};
 assert.equal(calendarDays(raw,'2026-11').filter(day=>day.work).length,30);
 const c=normalizeConfig(raw);assert.equal(snapshot(c,now).state,'working');assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(c))),c);
});

test('year rollover keeps the cycle phase and salary boundary independent',()=>{
 const c=normalizeConfig({...defaultConfig(at('2026-12-31T10:00:00'),'Asia/Shanghai'),salary:'8000',workDays:2,restDays:1,anchor:'2026-12-30'});
 assert.equal(snapshot(c,at('2026-12-31T23:59:59')).earned,'8000.0000');
 assert.equal(snapshot(c,at('2027-01-01T10:00:00')).state,'rest');assert.equal(snapshot(c,at('2027-01-01T10:00:00')).earned,'0.0000');
 assert.equal(snapshot(c,at('2027-01-02T10:00:00')).state,'working');
});
test('confirming a new monthly calendar backfills only elapsed scheduled work',()=>{
 const old=config({mode:'monthly',monthlyRestDays:0,offDays:[]}),time=at('2026-12-02T10:00:00');assert.equal(snapshot(old,time).state,'pending');
 const confirmed=normalizeConfig({...old,month:'2026-12',salary:'24000',monthlyRestDays:1,offDays:['2026-12-01']});
 assert.equal(snapshot(confirmed,time).earned,'100.0000');assert.equal(snapshot(confirmed,time).today,'100.0000');
});
