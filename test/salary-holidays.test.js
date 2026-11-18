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
test('empty next-year placeholders remain unavailable and cannot silently clear a schedule',()=>{
 const month=monthHolidays('2027-02');assert.equal(month.available,false);assert.deepEqual(month.days,[]);assert.throws(()=>applyHolidaySchedule(raw({month:'2027-02'})),{code:'salary.holidaysUnavailable'});assert.equal(monthHolidays('2026-11').available,true);assert.deepEqual(monthHolidays('2026-11').days,[]);
});
