import test from 'node:test';
import assert from 'node:assert/strict';
import * as policies from '../src/tools/payroll/policy.js';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {calculateAnnual} from '../src/tools/payroll/tax.js';
import * as input from '../src/tools/payroll/tax-input.js';
const p=(city='beijing',month='2026-11')=>policies.resolveEstimatePolicy(city,month);
const payment=(salary='20000',city='beijing',month='2026-11',extra={})=>{const policy=p(city,month),housing=policy.items.find(i=>i.id==='housing');return calculateContributions({salary,rates:{housing:{employee:housing.rateMax,employer:housing.rateMax}},...extra},policy);};
test('automatic Beijing uses dated component caps, a fixed medical fee and the highest ordinary housing rate',()=>{
 assert.equal(typeof policies.resolveEstimatePolicy,'function');const r=payment();assert.equal(r.employeeTotal,'4503.00');assert.equal(r.employeeSocial,'2103.00');assert.equal(r.employeeHousing,'2400.00');assert.notEqual(r.conditions.reference,true);
 const cap=payment('100000');assert.equal(cap.employeeTotal,'8181.54');assert.equal(cap.items.find(i=>i.id==='housing').employeeAmount,'4362.00');assert.equal(cap.items[0].base,'36348.00');
 assert.equal(payment('1000').items.find(i=>i.id==='housing').base,'2540.00');assert.equal(payment('1000').items[0].base,'7270.00');
});
test('Shanghai limits ordinary housing to seven percent and keeps an unknown company amount unknown',()=>{
 const r=payment('20000','shanghai');assert.equal(p('shanghai').items.find(i=>i.id==='housing').rateMax,'0.07');assert.equal(r.employeeHousing,'1400.00');assert.equal(r.employeeTotal,'3500.00');assert.equal(r.employerTotal,null);assert.throws(()=>payment('20000','shanghai','2026-11',{rates:{housing:{employee:'.12',employer:'.12'}}}),e=>e.code==='insurance.rateRange');
});
test('per-component reference rules keep their status and never share the housing cap with pension',()=>{
 const policy=p('guangzhou');assert.equal(policy.reference,true);assert.equal(policy.items.find(i=>i.id==='housing').max,'41697');assert.equal(policy.items.find(i=>i.id==='pension').max,'27603');assert.equal(payment('999999','guangzhou').items.find(i=>i.id==='pension').base,'27603.00');assert.equal(p('beijing','2026-01').items[0].max,'35811');assert.equal(p('beijing','2027-11').reference,true);assert.throws(()=>p('beijing',''),e=>e.code==='insurance.month');
});
test('ordinary manual payment rejects inconsistent or above-cap input; exceptional cash needs separate deduction',()=>{
 assert.equal(typeof input.manualWagePayment,'function');assert.throws(()=>input.manualWagePayment({salary:'20000',contributions:'200000',limit:'8181.54'}),e=>e.code==='tax.paymentRange');assert.throws(()=>input.manualWagePayment({salary:'20000',contributions:'9000',limit:'8181.54'}),e=>e.code==='tax.paymentRange');
 assert.deepEqual(input.manualWagePayment({salary:'20000',contributions:'0',limit:'8181.54'}),{contributions:'0.00',deductibleContributions:'0.00'});
 assert.throws(()=>input.manualWagePayment({salary:'20000',contributions:'200000',exception:true,limit:'8181.54'}));assert.deepEqual(input.manualWagePayment({salary:'20000',contributions:'200000',exception:true,deductibleContributions:'4503',limit:'8181.54'}),{contributions:'200000.00',deductibleContributions:'4503.00'});
 assert.throws(()=>input.manualWagePayment({salary:'20000',contributions:'9000',exception:true,deductibleContributions:'9000',limit:'8181.54'}),e=>e.code==='tax.deductionRange');
});
test('all twelve monthly amounts and annual totals match an independent fixed example',()=>{
 const months=Array.from({length:12},(_,i)=>{const c=payment('20000','beijing',`2026-${String(i+1).padStart(2,'0')}`);return {month:i+1,salary:'20000',contributions:c.employeeTotal,deductibleContributions:c.taxDeductible};});const r=calculateAnnual({year:2026,months});
 assert.deepEqual(r.months.map(m=>m.withheld),['314.91','314.91','314.91','734.07',...Array(8).fill('1049.70')]);assert.equal(r.cashAfterAnnualTax,'175887.60');assert.equal(r.contributions,'54036.00');
});
test('a missing social period does not discard an independently applicable housing limit',()=>{
 const policy=p('shanghai','2027-01');assert.equal(policy.reference,true);assert.equal(policy.items.find(i=>i.id==='housing').rateMax,'0.07');
});
