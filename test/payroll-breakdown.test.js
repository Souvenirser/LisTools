import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {resolveEstimatePolicy} from '../src/tools/payroll/policy.js';
import {buildPayrollBreakdowns} from '../src/tools/payroll/breakdown-model.js';

const amounts=group=>Object.fromEntries(group.rows.map(row=>[row.id,row.amount]));
const cents=value=>BigInt(value.replace('.',''));
const sumCents=rows=>rows.reduce((total,row)=>total+cents(row.amount),0n);
function cityPayment(city){
 const policy=resolveEstimatePolicy(city,'2026-11'),housing=policy.items.find(item=>item.id==='housing').rateMax;
 return calculateContributions({salary:'20000',rates:{housing:{employee:housing,employer:housing}}},policy);
}

test('the two charts independently reconcile to gross pay and employer cost, to the cent',()=>{
 const contributions=cityPayment('beijing');
 const {personal,employer}=buildPayrollBreakdowns({gross:'20000.00',net:'14447.30',tax:'1049.70',employeeTotal:'4503.00',contributions});
 assert.deepEqual(amounts(personal),{net:'14447.30',tax:'1049.70',pension:'1600.00',medical:'403.00',unemployment:'100.00',maternity:'0.00',injury:'0.00',housing:'2400.00'});
 assert.deepEqual(amounts(employer),{gross:'20000.00',pension:'3200.00',medical:'1960.00',unemployment:'100.00',maternity:'0.00',injury:'40.00',housing:'2400.00'});
 assert.equal(sumCents(personal.rows.filter(row=>['pension','medical','unemployment','maternity','injury'].includes(row.id))),210300n);
 assert.equal(sumCents(personal.rows),2000000n);assert.equal(sumCents(employer.rows),2770000n);
 assert.equal(personal.total,'20000.00');assert.equal(employer.total,'27700.00');
 assert.equal(personal.status,'complete');assert.equal(employer.status,'complete');
 assert.equal(personal.rows.find(row=>row.id==='net').percent,'72.2365');
 assert.equal(personal.rows.find(row=>row.id==='housing').percent,'12');
 assert.equal(personal.rows.find(row=>row.id==='injury').percent,'0');
});

test('manual employee cash is one line; the unknown employer payment cannot become zero',()=>{
 const {personal,employer}=buildPayrollBreakdowns({gross:'20000.00',net:'16700.00',tax:'1300.00',employeeTotal:'2000.00',contributions:null});
 assert.deepEqual(amounts(personal),{net:'16700.00',tax:'1300.00',employeeTotal:'2000.00'});
 assert.equal(personal.status,'complete');
 assert.deepEqual(amounts(employer),{gross:'20000.00',employerTotal:null});
 assert.equal(employer.status,'partial');assert.equal(employer.total,null);
 assert.ok(employer.rows.every(row=>row.percent===null));
});

test('a partial employer retains the known charges and a before-tax employee chart never invents tax',()=>{
 const contributions=cityPayment('shanghai');
 const {personal,employer}=buildPayrollBreakdowns({gross:'20000.00',net:contributions.cashBeforeTax,tax:null,employeeTotal:contributions.employeeTotal,contributions});
 assert.equal(amounts(personal).beforeTax,'16500.00');assert.ok(!('net' in amounts(personal)));assert.ok(!('tax' in amounts(personal)));
 assert.equal(personal.status,'complete');assert.equal(sumCents(personal.rows),2000000n);
 assert.deepEqual(amounts(employer),{gross:'20000.00',pension:'3200.00',medical:'1800.00',unemployment:null,maternity:'0.00',injury:'40.00',housing:'1400.00'});
 assert.equal(employer.total,null);assert.ok(employer.rows.every(row=>row.percent===null));
 const withZeroTax=buildPayrollBreakdowns({gross:'100.00',net:'100.00',tax:'0.00',employeeTotal:'0.00'}).personal;
 assert.deepEqual(amounts(withZeroTax),{net:'100.00',tax:'0.00',employeeTotal:'0.00'});
});

test('zero denominator, negative take-home, a missing input and a one-cent mismatch retain amounts without shares',()=>{
 const cases=[
  {gross:'0.00',net:'0.00',tax:'0.00',employeeTotal:'0.00'},
  {gross:'1.00',net:'-2.00',tax:'0.00',employeeTotal:'3.00'},
  {gross:'100.00',net:null,tax:'1.00',employeeTotal:'2.00'},
  {gross:'100.00',net:'97.01',tax:'1.00',employeeTotal:'2.00'}
 ];
 for(const input of cases){
  const {personal}=buildPayrollBreakdowns(input);
  assert.equal(amounts(personal).net,input.net);assert.notEqual(personal.status,'complete');assert.ok(personal.rows.every(row=>row.percent===null));
 }
 const contributions=cityPayment('beijing');
 const differentTotal=buildPayrollBreakdowns({gross:'20000.00',net:'14447.30',tax:'1049.70',employeeTotal:'4502.99',contributions});
 assert.notEqual(differentTotal.personal.status,'complete');
});

test('large fractional amounts are not coerced to floating point; fully known zero employer costs are valid',()=>{
 const gross='999999999999999.99',contributions={employeeTotal:'0.01',employerTotal:'0.00',items:[{id:'supplemental',employeeAmount:'0.01',employerAmount:'0.00'}]};
 const {personal,employer}=buildPayrollBreakdowns({gross,net:'999999999999999.98',tax:'0.00',employeeTotal:'0.01',contributions});
 assert.equal(sumCents(personal.rows),99999999999999999n);assert.equal(personal.total,gross);
 assert.notEqual(personal.rows.find(row=>row.id==='supplemental').percent,'0');
 assert.equal(employer.total,gross);assert.equal(employer.status,'complete');assert.equal(employer.rows[0].percent,'100');
});

test('a bonus month identifies its combined gross amount on both sides',()=>{
 const input={gross:'50000.00',net:'43547.30',tax:'1949.70',employeeTotal:'4503.00',contributions:cityPayment('beijing')};
 const label='payroll.salary+taxEase.bonus',{personal,employer}=buildPayrollBreakdowns({...input,grossLabel:label});
 assert.equal(personal.baseLabel,label);assert.equal(employer.rows[0].label,label);
 assert.equal(personal.total,'50000.00');assert.equal(employer.total,'57700.00');
 assert.equal(personal.status,'complete');assert.equal(employer.status,'complete');
});
