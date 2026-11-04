import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {calculateWage,calculateBonus,calculateAnnual,calculateWageWithPolicy,taxOn} from '../src/tools/payroll/tax.js';

// Synthetic policy: arithmetic fixtures, not a city's published rates.
const rule=(id,employee,employer,extra={})=>({id,min:'1000',max:'20000',employee,employer,employeeFixed:'0',employerFixed:'0',digits:2,rounding:'half-up',verified:true,...extra});
const policy={cityId:'fixture',month:'2026-11',custom:false,items:[rule('pension','0.08','0.16'),rule('medical','0.02','0.09',{employeeFixed:'3'}),rule('unemployment','0.005','0.005'),rule('maternity','0','0',{mergedInto:'medical'}),rule('injury','0','0.002'),rule('housing','0.07','0.07',{digits:0,rateMin:'0.05',rateMax:'0.12'})]};
const code=(fn,want)=>assert.throws(fn,error=>error.code===want);
test('contributions distinguish personal cash, company cost and housing credit',()=>{
 const r=calculateContributions({salary:'10000',mode:'estimate'},policy);
 assert.equal(r.employeeTotal,'1753.00');assert.equal(r.employerTotal,'3270.00');assert.equal(r.housingCredit,'1400.00');assert.equal(r.cashBeforeTax,'8247.00');assert.equal(r.companyCost,'13270.00');assert.equal(r.taxDeductible,'1753.00');
 assert.equal(r.items.find(i=>i.id==='maternity').employerAmount,'0.00');
});
test('estimate clamps each component and actual bases are never silently rewritten',()=>{
 const r=calculateContributions({salary:'500',mode:'estimate'},policy);assert.equal(r.items[0].base,'1000.00');
 code(()=>calculateContributions({salary:'500',mode:'actual',base:'500'},policy),'insurance.baseRange');
 const x=calculateContributions({salary:'10000',mode:'actual',base:'5000',bases:{medical:'6000',housing:'7000'}},policy);assert.equal(x.items[0].base,'5000.00');assert.equal(x.items[1].base,'6000.00');assert.equal(x.housingCredit,'980.00');
});
test('separate housing rates and line rounding are applied before totals',()=>{
 const r=calculateContributions({salary:'37731',rates:{housing:{employee:'0.07',employer:'0.05'}}},{...policy,items:[rule('housing','0.07','0.07',{min:'2740',max:'37731',digits:0,rateMin:'0.05',rateMax:'0.07'})]});
 assert.equal(r.employeeTotal,'2641.00');assert.equal(r.employerTotal,'1887.00');assert.equal(r.housingCredit,'4528.00');
});
test('zero salary does not imply no participation; explicit exemption is different',()=>{
 assert.equal(calculateContributions({salary:'0'},policy).items[0].base,'1000.00');
 assert.equal(calculateContributions({salary:'0',excluded:policy.items.map(i=>i.id)},policy).employeeTotal,'0.00');
});
test('unknown company amount is not zero and does not hide known personal results',()=>{
 const r=calculateContributions({salary:'10000'},{...policy,items:[rule('pension','0.08',null)]});
 assert.equal(r.employeeTotal,'800.00');assert.equal(r.employerTotal,null);assert.equal(r.companyCost,null);
 const custom=calculateContributions({salary:'10000',rates:{pension:{employer:null}}},{...policy,custom:true,items:[rule('pension','.08','0')]});assert.equal(custom.employerTotal,null);assert.equal(custom.companyCost,null);
});
test('unknown personal policy blocks instead of accepting an upstream guess',()=>{
 code(()=>calculateContributions({salary:'10000'},{...policy,items:[rule('medical','0.02','0.09',{verified:false})]}),'insurance.unverified');
});
test('custom actual cash is separate from confirmed tax deduction and adjustment',()=>{
 const p={...policy,custom:true,items:[rule('housing','0.2','0.2',{digits:0})]};
 const r=calculateContributions({salary:'10000',deductible:'1200',taxableAdjustment:'800'},p);
 assert.equal(r.employeeTotal,'2000.00');assert.equal(r.taxDeductible,'1200.00');assert.equal(r.taxableAdjustment,'800.00');
 assert.equal(calculateContributions({salary:'10000'},p).taxDeductible,null);
});
test('invalid numeric values and rates are rejected with field codes',()=>{
 for(const salary of ['','-1','Infinity','1,23','1e5'])code(()=>calculateContributions({salary},policy),'payroll.amount');
 code(()=>calculateContributions({salary:'1',rates:{housing:{employee:'0.04'}}},policy),'insurance.rateRange');
 code(()=>calculateContributions({salary:'10000',rates:{pension:{employee:'.2'}}},policy),'insurance.rateRange');
});
test('all cumulative tax brackets handle exact decimal boundaries',()=>{
 for(const [x,t]of [['0','0.00'],['36000','1080.00'],['36000.01','1080.00'],['144000','11880.00'],['300000','43080.00'],['420000','73080.00'],['660000','145080.00'],['960000','250080.00'],['960001','250080.45']])assert.equal(taxOn(x).tax,t,x);
});
test('wages use cumulative withholding rather than a flat monthly tax',()=>{
 const first=calculateWage({salary:'10000',month:1,startMonth:1});const eighth=calculateWage({salary:'10000',month:8,startMonth:1});
 assert.equal(first.currentTax,'150.00');assert.equal(eighth.currentTax,'430.00');assert.equal(eighth.net,'9570.00');
});
test('first annual employment must be explicit and does not inflate cumulative income',()=>{
 const a=calculateWage({salary:'10000',month:8,startMonth:8});const b=calculateWage({salary:'10000',month:8,startMonth:8,firstEmployment:true});
 assert.equal(a.currentTax,'150.00');assert.equal(b.currentTax,'0.00');assert.equal(b.cumulativeIncome,'10000.00');assert.equal(b.basicDeduction,'40000.00');
});
test('actual first salary allowance is not counted twice and invalid rates retain a field code',()=>{
 const r=calculateWage({mode:'actual',salary:'50000',month:8,startMonth:8,firstEmployment:true});
 assert.equal(r.basicDeduction,'40000.00');assert.equal(r.currentTax,'300.00');
 code(()=>calculateContributions({salary:'10000',rates:{housing:{employee:'bad'}}},policy),'insurance.rateRange');
});
test('city-based quick wages resolve each month rather than carrying current policy backwards',()=>{
 const requested=[];const r=calculateWageWithPolicy({salary:'10000',month:8,startMonth:7},month=>{requested.push(month);return {employeeTotal:month===7?'1000':'2000',taxDeductible:month===7?'1000':'2000',taxableAdjustment:'0',conditions:{month}};});
 assert.deepEqual(requested,[7,8]);assert.equal(r.currentTax,'90.00');assert.equal(r.net,'7910.00');
 code(()=>calculateWageWithPolicy({salary:'10000',month:8,startMonth:7},()=>{throw {code:'tax.policyMissing'};}),'tax.policyMissing');
});
test('actual cumulative withholding can be zero but never refunds through monthly payroll',()=>{
 const r=calculateWage({mode:'actual',salary:'10000',month:2,startMonth:1,previous:{income:'10000',withheld:'9999',basic:'5000'}});
 assert.equal(r.currentTax,'0.00');assert.equal(r.cumulativeTax,'300.00');
});
test('cash deductions and special deductions are never subtracted twice',()=>{
 const r=calculateWage({salary:'10000',contributions:'1000',deductibleContributions:'800',specialDeduction:'1500',month:1,startMonth:1});
 assert.equal(r.currentTax,'81.00');assert.equal(r.net,'8919.00');
});
test('actual cumulative sums and date ranges reject missing or inconsistent inputs',()=>{
 code(()=>calculateWage({salary:'10000',month:1,startMonth:2}),'tax.monthRange');
 code(()=>calculateWage({mode:'actual',salary:'10000',month:2,startMonth:1}),'tax.previousRequired');
});
test('bonus cliff and baseline comparison use annual total taxes',()=>{
 assert.equal(calculateBonus({bonus:'36000',year:2026}).separateTax,'1080.00');
 assert.equal(calculateBonus({bonus:'36001',year:2026}).separateTax,'3390.10');
 const r=calculateBonus({bonus:'36000',year:2026,annualTaxable:'60000'});
 assert.equal(r.separateTotal,'4560.00');assert.equal(r.combinedTotal,'7080.00');assert.equal(r.saving,'2520.00');
 assert.equal(calculateBonus({bonus:'1',year:2026}).combinedTotal,null);
 code(()=>calculateBonus({bonus:'1',year:2028}),'tax.bonusExpired');
});
test('bonus comparison retains the unused annual basic allowance',()=>{
 const r=calculateBonus({year:2026,bonus:'30000',annualBasis:{salary:'30000',contributions:'0',special:'0',other:'0',medical:'0'}});
 assert.equal(r.separateTotal,'900.00');assert.equal(r.combinedTotal,'0.00');assert.equal(r.preferred,'combined');assert.equal(r.salaryBalance,'-30000.00');
});
test('annual deduction remains 60000 even when only one month has income',()=>{
 const r=calculateAnnual({year:2026,months:[{month:12,salary:'60000'}]});assert.equal(r.annualTax,'0.00');assert.equal(r.refund,null);
 const q=calculateAnnual({year:2026,months:[{month:12,salary:'60000'}],actualWithheld:'1000'});assert.equal(q.refund,'1000.00');
});
test('annual medical deductions do not enter monthly withholding or double count cash',()=>{
 const r=calculateAnnual({year:2026,months:Array.from({length:12},(_,i)=>({month:i+1,salary:'10000'})),medicalDeduction:'10000'});
 assert.equal(r.annualTax,'2480.00');assert.equal(r.predictedWithheld,'3480.00');assert.equal(r.refund,null);
});
test('annual variable income sums real months and validates duplicate months',()=>{
 const r=calculateAnnual({year:2026,months:[{month:1,salary:'10000',contributions:'1000'},{month:2,salary:'20000',contributions:'2000'}]});assert.equal(r.gross,'30000.00');assert.equal(r.contributions,'3000.00');assert.equal(r.cashAfterAnnualTax,'27000.00');
 code(()=>calculateAnnual({year:2026,months:[{month:1,salary:'1'},{month:1,salary:'1'}]}),'tax.duplicateMonth');
});
