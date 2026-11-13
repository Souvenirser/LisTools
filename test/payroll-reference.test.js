import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/tools/payroll/policy.js';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {calculateWage,calculateWageWithPolicy,calculateAnnual} from '../src/tools/payroll/tax.js';

const reference=(city,month='2026-11')=>{assert.equal(typeof policy.resolveReferencePolicy,'function');return policy.resolveReferencePolicy(city,month);};
test('twenty explicitly sourced reference cities calculate without being relabelled as official verification',()=>{
 for(const city of policy.cities){
  const p=reference(city.id),r=calculateContributions({salary:'10000'},p);
  assert.equal(p.reference,true);assert.ok(p.items.every(i=>!i.verified));assert.ok(p.sources.some(s=>s.url.startsWith('https://sbjsq.tixiaolu.com/')));
  assert.ok(Number(r.employeeTotal)>0);assert.ok(Number(r.employerTotal)>0);assert.equal(r.conditions.reference,true);assert.equal(r.conditions.referenceAsOf,'2026-11-13');
  const personal=r.items.reduce((sum,i)=>sum+Math.round(Number(i.employeeAmount)*100),0);
  assert.equal(personal,Math.round(Number(r.employeeTotal)*100));
  assert.equal(r.items.find(i=>i.id==='injury').employeeAmount,'0.00');assert.equal(r.items.find(i=>i.id==='maternity').employeeAmount,'0.00');
 }
});
test('reference Beijing and Guangzhou match the selected source calculator at a normal salary',()=>{
 for(const [city,expected] of [['beijing','1750.00'],['guangzhou','1720.00']]){
  const r=calculateContributions({salary:'10000'},reference(city));assert.equal(r.employeeTotal,expected);
 }
 const r=calculateContributions({salary:'10000'},reference('beijing'));assert.equal(r.employerTotal,'3310.00');
});
test('exported source hashes identify the same page as each source URL',async()=>{
 const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile(new URL('../src/tools/payroll/reference-cities.json',import.meta.url),'utf8'));
 for(const city of data.cities){const p=reference(city.id);assert.equal(p.sources.find(s=>s.url===city.sourceUrl)?.sha256,city.sourceSha256);assert.equal(p.sources.find(s=>s.url===data.source.url)?.sha256,data.source.sha256);}
});
test('reference bases cap both social and housing estimates and preserve cent precision',()=>{
 const p=reference('beijing');
 for(const [salary,base,personal] of [['1','7162.00','1253.35'],['99999','35811.00','6266.93'],['10050','10050.00','1758.75']]){
  const r=calculateContributions({salary},p);assert.ok(r.items.every(i=>i.base===base));assert.equal(r.employeeTotal,personal);
 }
 assert.throws(()=>calculateContributions({salary:''},p));
 assert.equal(calculateContributions({salary:'0'},p).employeeTotal,'1253.35');
});
test('reference snapshots remain explicit for other months without changing the strict official resolver',()=>{
 for(const month of ['2026-01','2026-11','2027-01']){
  const p=reference('hangzhou',month);assert.equal(p.month,month);assert.equal(p.referenceAsOf,'2026-11-13');
  assert.equal(calculateContributions({salary:'10000'},p).employeeTotal,'1750.00');
 }
 assert.throws(()=>policy.resolvePolicy('hangzhou','2027-01'),e=>e.code==='tax.policyMissing');
 assert.throws(()=>reference('unknown'),e=>e.code==='insurance.choose');
 assert.throws(()=>reference('beijing',''),e=>e.code==='insurance.month');
});
test('reference payments feed the existing cumulative wage and annual tax calculations',()=>{
 const r=calculateWage({year:2026,month:11,salary:'20000',contributions:'2000',deductibleContributions:'2000'});
 assert.equal(r.currentTax,'1300.00');assert.equal(r.net,'16700.00');
 const monthly=n=>calculateContributions({salary:'20000'},reference('beijing',`2026-${String(n).padStart(2,'0')}`));
 const wage=calculateWageWithPolicy({year:2026,month:11,salary:'20000'},monthly);
 assert.equal(wage.currentTax,'1150.00');assert.equal(wage.net,'15350.00');assert.equal(wage.conditions.policies.length,11);
 const annual=calculateAnnual({year:2026,months:Array.from({length:12},(_,i)=>({month:i+1,salary:'20000',contributions:monthly(i+1).employeeTotal}))});
 assert.equal(annual.gross,'240000.00');assert.equal(annual.contributions,'42000.00');
});
