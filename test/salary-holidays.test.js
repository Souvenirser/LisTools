import test from 'node:test';
import assert from 'node:assert/strict';
import {monthHolidays,applyHolidaySchedule} from '../src/tools/salary/holidays.js';
import {defaultConfig,normalizeConfig,snapshot,calendarDays} from '../src/tools/salary/core.js';
const now=Date.parse('2026-10-08T10:00:00+08:00');
const raw=changes=>({...defaultConfig(now,'Asia/Shanghai'),salary:'16800',...changes});
test('bundled holiday data distinguishes National Day time off and makeup work',()=>{
 const month=monthHolidays('2026-10');assert.equal(month.available,true);assert.equal(month.days.length,8);assert.deepEqual(month.days.find(day=>day.date==='2026-10-01'),{name:'国庆节',date:'2026-10-01',isOffDay:true});assert.equal(month.days.find(day=>day.date==='2026-10-10').isOffDay,false);
 const spring=monthHolidays('2026-02');assert.equal(spring.days.filter(day=>day.isOffDay).length,9);assert.equal(spring.days.find(day=>day.date==='2026-02-14').isOffDay,false);assert.equal(spring.days.find(day=>day.date==='2026-02-28').isOffDay,false);
});
test('applying public dates produces a draft and preserves unrelated custom cycle overrides',()=>{
 const input=raw({overrides:{'2026-10-12':'rest'}}),saved=normalizeConfig(input),before=snapshot(saved,now),draft=applyHolidaySchedule(input),days=calendarDays(draft,'2026-10');
 assert.equal(days.find(day=>day.date==='2026-10-01').work,false);assert.equal(days.find(day=>day.date==='2026-10-10').work,true);assert.equal(days.find(day=>day.date==='2026-10-12').work,false);assert.deepEqual(input.overrides,{'2026-10-12':'rest'});assert.deepEqual(snapshot(saved,now),before);
});
test('monthly application keeps the explicit rest target and requires resolving count differences',()=>{
 const input=raw({mode:'monthly',monthlyRestDays:2,offDays:['2026-10-10','2026-10-12']}),draft=applyHolidaySchedule(input);
 assert.equal(draft.monthlyRestDays,2);assert.equal(draft.offDays.includes('2026-10-10'),false);assert.equal(draft.offDays.includes('2026-10-12'),true);assert.equal(draft.offDays.includes('2026-10-01'),true);assert.throws(()=>normalizeConfig(draft),{code:'salary.restCount'});assert.deepEqual(input.offDays,['2026-10-10','2026-10-12']);
});
test('2027 contains the official holidays and makeup days, including adjacent months',()=>{
 const months=Array.from({length:12},(_,i)=>monthHolidays('2027-'+String(i+1).padStart(2,'0')));
 assert.ok(months.every(month=>month.available&&month.version==='2026.11.05'));
 const days=months.flatMap(month=>month.days);
 assert.equal(days.filter(day=>day.isOffDay).length,29);
 assert.deepEqual(days.filter(day=>!day.isOffDay).map(day=>day.date),
  ['2027-01-31','2027-02-14','2027-05-08','2027-09-26','2027-10-09']);
 assert.deepEqual(months[1].days.filter(day=>day.isOffDay).map(day=>day.date),
  ['05','06','07','08','09','10','11','12','13'].map(day=>'2027-02-'+day));
 assert.equal(months[9].days.filter(day=>day.isOffDay&&day.name==='国庆节').length,7);
});
test('an unpublished year cannot apply holidays but a known month can have none',()=>{
 const month=monthHolidays('2028-02');assert.equal(month.available,false);assert.deepEqual(month.days,[]);assert.throws(()=>applyHolidaySchedule(raw({month:'2028-02'})),{code:'salary.holidaysUnavailable'});assert.equal(monthHolidays('2027-03').available,true);assert.deepEqual(monthHolidays('2027-03').days,[]);
});
