import test from 'node:test';
import assert from 'node:assert/strict';
import {cities,resolvePolicy} from '../src/tools/payroll/policy.js';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {pages,searchNavigation,currentTarget} from '../src/tools/shared/navigation.js';

test('twenty cities have stable identities, aliases and traceable verification status',()=>{
 assert.equal(cities.length,20);assert.equal(new Set(cities.map(c=>c.id)).size,20);
 for(const city of cities){assert.ok(city.name&&city.province&&city.search);assert.ok(city.upstream.commit);assert.ok(city.periods.length);for(const p of city.periods)for(const item of p.items){assert.ok(['verified','reference'].includes(item.verification));assert.ok(item.sources.length);}}
});
test('policy selection uses each component interval and refuses uncovered months',()=>{
 assert.equal(resolvePolicy('beijing','2026-11').items[0].min,'7270');
 assert.equal(resolvePolicy('beijing','2026-06').items[0].min,'7162');
 assert.equal(resolvePolicy('beijing','2026-06').items.find(i=>i.id==='housing').max,'35811');
 assert.throws(()=>resolvePolicy('beijing','2027-01'),e=>e.code==='tax.policyMissing');
 assert.throws(()=>resolvePolicy('beijing','2028-01'),e=>e.code==='tax.policyMissing');
});
test('verified Beijing policy matches independent employee and fund arithmetic',()=>{
 const r=calculateContributions({salary:'10000'},resolvePolicy('beijing','2026-11'));
 assert.equal(r.employeeSocial,'1053.00');assert.equal(r.employeeHousing,'700.00');assert.equal(r.employeeTotal,'1753.00');
});
test('Shanghai uses published housing limits and capped seven percent',()=>{
 const p=resolvePolicy('shanghai','2026-11');const r=calculateContributions({salary:'99999'},p);
 assert.equal(r.items.find(i=>i.id==='housing').employeeAmount,'2641.00');
 assert.throws(()=>calculateContributions({salary:'10000',rates:{housing:{employee:'.12'}}},p),e=>e.code==='insurance.rateRange');
});
test('unverified upstream values never silently become verified or current forever',()=>{
 const p=resolvePolicy('hangzhou','2026-11');assert.ok(p.items.some(i=>!i.verified));
 assert.throws(()=>calculateContributions({salary:'10000'},p),e=>e.code==='insurance.unverified');
});
test('Fujian pension and unemployment use the newly published 2026 rules, not upstream stale bases',()=>{
 const p=resolvePolicy('fuzhou','2026-11');
 assert.equal(p.items.find(i=>i.id==='pension').min,'4579');assert.equal(p.items.find(i=>i.id==='unemployment').max,'22893');
});
test('local policy identifiers never accept URLs, script or arbitrary injection',()=>{
 for(const city of ['unknown','https://e.test','__proto__'])assert.throws(()=>resolvePolicy(city,'2026-11'),e=>e.code==='insurance.choose');
});
test('both independent tools are searchable while retired recruiting tools remain absent',()=>{
 for(const id of ['insurance','tax'])assert.equal(pages.find(p=>p.id===id).file,id+'.html');
 for(const query of ['五险一金','社保','公积金'])assert.ok(searchNavigation(query).some(p=>p.file==='insurance.html'));
 assert.ok(searchNavigation('年终奖').some(p=>p.file==='tax.html#bonus'));
 assert.equal(currentTarget('/tax.html','#annual'),'tax.html#annual');
 assert.ok(!pages.some(p=>['salary','interview','experience'].includes(p.id)));
});
