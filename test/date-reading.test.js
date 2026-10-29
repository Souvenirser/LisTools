import test from 'node:test';
import assert from 'node:assert/strict';
import {difference,shiftDate,dateMilestone,parseDateList} from '../src/tools/dates/core.js';

test('date inputs and returned dates stay in the four-digit positive-year range',()=>{
 for(const value of ['0000-01-01','+010000-01-01'])assert.throws(()=>difference(value,'2026-01-01'),{code:'dates.invalidDate'});
 assert.equal(shiftDate('0001-01-01',0,'days'),'0001-01-01');
 for(const args of [['9999-12-31',1,'days'],['0001-01-01',-1,'days'],['2026-01-01',10000,'years']])assert.throws(()=>shiftDate(...args),{code:'dates.outOfRange'});
 assert.throws(()=>dateMilestone('0001-01-01','9999-12-31'),{code:'dates.outOfRange'});
 assert.throws(()=>parseDateList('0000-01-01'),{code:'dates.invalidDate'});
});
test('date snapshots preserve calculation conditions independently from timestamp settings',async()=>{
 const {calculateDateResult}=await import('../src/tools/dates/results.js');
 const input={base:'2026-10-28',amount:'7',unit:'days'},result=calculateDateResult('shift',input);input.base='2020-01-01';
 assert.equal(result.value,'2026-11-04');assert.equal(result.input.base,'2026-10-28');assert.deepEqual(result.dates,[{key:'result',date:'2026-11-04'}]);
 assert.deepEqual(calculateDateResult('difference',{start:'2026-01-01',end:'2026-01-02',inclusive:false}).dates,[{key:'start',date:'2026-01-01'},{key:'end',date:'2026-01-02'}]);
});
test('derived timestamps use the chosen clock and zone without changing calendar dates',async()=>{
 const {dateTimestamp}=await import('../src/tools/dates/results.js');
 const value=dateTimestamp('2026-11-04','00:00','Asia/Shanghai');assert.equal(value.seconds,'1793721600');assert.equal(value.milliseconds,'1793721600000');
 assert.equal(dateTimestamp('1970-01-01','00:00:00.000','UTC').milliseconds,'0');assert.equal(dateTimestamp('1969-12-31','23:59:59.999','UTC').seconds,'-1');
 assert.equal(dateTimestamp('2026-11-04','00:00:00.123','Asia/Shanghai').milliseconds,'1793721600123');
 assert.equal(dateTimestamp('2026-11-04','00:00','Asia/Kathmandu').offset,'+05:45');
 for(const time of ['', '24:00', '1:00', '00:00:00.0001'])assert.equal(dateTimestamp('2026-11-04',time,'UTC').code,'dates.invalidTime');
 for(const [date,time,zone]of [['2024-03-10','02:30','America/New_York'],['2024-11-03','01:30','America/New_York'],['2011-12-30','00:00','Pacific/Apia']])assert.equal(dateTimestamp(date,time,zone).code,'timestamp.ambiguous');
});
test('calendar days stay independent of a 23-hour DST day',async()=>{
 const {calculateDateResult,dateTimestamp}=await import('../src/tools/dates/results.js');
 const result=calculateDateResult('shift',{base:'2024-03-10',amount:'1',unit:'days'});assert.equal(result.value,'2024-03-11');
 const start=dateTimestamp('2024-03-10','00:00','America/New_York'),end=dateTimestamp(result.value,'00:00','America/New_York');assert.equal(Number(end.milliseconds)-Number(start.milliseconds),23*60*60*1000);
});
