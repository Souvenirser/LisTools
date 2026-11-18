import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAnnual,calculateBonus} from '../src/tools/payroll/tax.js';
import {combinePayrollResults} from '../src/tools/payroll/tax-summary.js';

const months=Array.from({length:12},(_,i)=>({month:i+1,salary:'10000',confirmedActual:true,predicted:false}));
const input={year:2026,actualWithheld:'3480',annualSpecialDeduction:'3600',months};
const closed=new Date('2026-12-31T16:00:00Z');

test('future months remain forecasts regardless of actual and forecast flags',()=>{
 const r=calculateAnnual(input,new Date('2026-10-31T16:00:00Z'));
 assert.equal(r.months[10].predicted,false);
 assert.equal(r.months[11].predicted,true);
 assert.equal(r.refund,null);
 assert.equal(r.annualTax,'3120.00');
});

test('annual refunds open at the Shanghai year boundary',()=>{
 assert.equal(calculateAnnual(input,new Date('2026-12-31T15:59:59Z')).refund,null);
 assert.equal(calculateAnnual(input,closed).refund,'360.00');
});

test('closing the year does not confirm missing, mixed, or projected history',()=>{
 for(const row of [{month:1,salary:'10000'}, {...months[0],predicted:true}, {...months[0],estimated:true}]){
  assert.equal(calculateAnnual({...input,months:[row,...months.slice(1)]},closed).refund,null);
 }
 assert.equal(calculateAnnual({...input,months:months.slice(1)},closed).refund,null);
});

test('confirmed no income and explicitly entered zero withholding are valid',()=>{
 const allZero=months.map(({month})=>({month,salary:'0',confirmedNoIncome:true}));
 assert.equal(calculateAnnual({...input,months:allZero,actualWithheld:'0'},closed).refund,'0.00');
 assert.equal(calculateAnnual({...input,months:allZero,actualWithheld:''},closed).refund,null);
 assert.throws(()=>calculateAnnual({...input,months:[{...allZero[0],salary:'1'},...allZero.slice(1)]},closed));
});

test('both bonus methods inherit annual eligibility and require actual bonus withholding',()=>{
 const bonus=calculateBonus({year:2026,bonus:'36000'});
 for(const method of ['separate','combined']){
  const open=calculateAnnual(input,new Date('2026-12-31T15:59:59Z'));
  const complete=calculateAnnual(input,closed);
  assert.equal(combinePayrollResults({annual:open,bonus,method,bonusMonth:'12',bonusActualWithheld:'0'}).refund,null);
  assert.equal(combinePayrollResults({annual:complete,bonus,method,bonusMonth:'12'}).refund,null);
  assert.notEqual(combinePayrollResults({annual:complete,bonus,method,bonusMonth:'12',bonusActualWithheld:'0'}).refund,null);
 }
});
