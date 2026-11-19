import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAnnual,calculateBonus} from '../src/tools/payroll/tax.js';
import {combinePayrollResults,annualBasisForBonus} from '../src/tools/payroll/tax-summary.js';

const annual=(extra={})=>calculateAnnual({year:2026,months:Array.from({length:12},(_,i)=>({month:i+1,salary:'20000',contributions:'2000',specialDeduction:'0',predicted:i===11})),...extra},new Date('2027-01-01T00:00:00Z'));
test('one shared salary basis includes yearly deductions exactly once',()=>{
 const r=annual();assert.deepEqual(annualBasisForBonus(r),{salary:'240000.00',contributions:'24000.00',special:'0.00',other:'0.00',medical:'0.00',adjustment:'0.00'});
 const s=combinePayrollResults({annual:r});assert.equal(s.totalIncome,'240000.00');assert.equal(s.totalAnnualTax,'14280.00');assert.equal(s.annualNet,'201720.00');assert.equal(s.refund,null);
});
test('separate bonus appears only in its chosen month and annual tax is not prepaid twice',()=>{
 const s=combinePayrollResults({annual:annual(),bonus:calculateBonus({year:2026,bonus:'36000'}),bonusMonth:'11'});
 assert.equal(s.totalIncome,'276000.00');assert.equal(s.totalAnnualTax,'15360.00');assert.equal(s.annualNet,'236640.00');
 assert.equal(s.months[10].bonus,'36000.00');assert.equal(s.months[10].bonusTax,'1080.00');assert.equal(s.months[10].totalNet,'51620.00');assert.equal(s.months[9].bonus,'0.00');assert.equal(s.months[9].net,'16700.00');
});
test('an unallocated bonus stays annual instead of being silently spread across months',()=>{
 const s=combinePayrollResults({annual:annual(),bonus:calculateBonus({year:2026,bonus:'36000'})});assert.equal(s.unallocatedBonus,true);assert.ok(s.months.every(m=>m.bonus==='0.00'));assert.equal(s.annualNet,'236640.00');
});
test('combined bonus recomputes monthly withholding using the existing annual core',()=>{
 const s=combinePayrollResults({annual:annual(),bonus:calculateBonus({year:2026,bonus:'36000'}),method:'combined',bonusMonth:'6'});
 assert.equal(s.totalAnnualTax,'21480.00');assert.equal(s.annualNet,'230520.00');assert.equal(s.months[5].bonus,'36000.00');assert.equal(s.months[5].totalNet,'49100.00');assert.equal(s.months[10].withheld,'2600.00');
});
test('combined bonus preserves unused annual allowance rather than adding to clipped taxable income',()=>{
 const a=calculateAnnual({year:2026,months:[{month:1,salary:'10000',contributions:'0'}]});const s=combinePayrollResults({annual:a,bonus:calculateBonus({year:2026,bonus:'30000'}),method:'combined'});assert.equal(s.totalAnnualTax,'0.00');assert.equal(s.annualNet,'40000.00');
});
test('bonus in an absent month is rejected and actual refunds require actual bonus withholding too',()=>{
 const b=calculateBonus({year:2026,bonus:'36000'});assert.throws(()=>combinePayrollResults({annual:annual(),bonus:b,bonusMonth:'13'}));
 const a=annual({months:Array.from({length:12},(_,i)=>({month:i+1,salary:'20000',contributions:'2000',confirmedActual:true,predicted:false})),actualWithheld:'14280'});
 assert.equal(combinePayrollResults({annual:a,bonus:b}).refund,null);assert.equal(combinePayrollResults({annual:a,bonus:b,bonusActualWithheld:'1080'}).refund,'0.00');
});
test('a future combined estimate stays available beyond the verified separate-tax window',()=>{
 const a=annual({year:2028,actualWithheld:'20000'});
 const input={year:2028,bonus:'36000',annualBasis:annualBasisForBonus(a)};
 assert.throws(()=>calculateBonus(input),{code:'tax.bonusExpired'});
 const bonus=calculateBonus(input,'combined');
 assert.equal(bonus.separateTax,null);
 assert.equal(bonus.saving,null);
 assert.equal(bonus.combinedTotal,'21480.00');
 const summary=combinePayrollResults({annual:a,bonus,method:'combined',bonusMonth:'6',bonusActualWithheld:'1080'});
 assert.equal(summary.totalAnnualTax,'21480.00');
 assert.equal(summary.months[5].bonus,'36000.00');
 assert.equal(summary.refund,null);
 assert.equal(summary.conditions.refundEligible,false);
});
test('a combined-only forecast does not become an actual refund when the device date advances',()=>{
 const months=Array.from({length:12},(_,i)=>({month:i+1,salary:'10000',confirmedActual:true}));
 const a=calculateAnnual({year:2028,months,actualWithheld:'20000'},new Date('2029-01-02T00:00:00Z'));
 assert.notEqual(a.refund,null);
 const bonus=calculateBonus({year:2028,bonus:'36000',annualBasis:annualBasisForBonus(a)},'combined');
 const summary=combinePayrollResults({annual:a,bonus,method:'combined',bonusActualWithheld:'1080'});
 assert.equal(summary.conditions.bonusCombinedEstimate,true);
 assert.equal(summary.refund,null);
 assert.equal(summary.conditions.refundEligible,false);
});
