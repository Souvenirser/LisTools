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
test('Fujian injury candidate starts after the July 2026 notice and remains unverified',()=>{
 for(const id of ['xiamen','fuzhou']){
  const rule=resolvePolicy(id,'2026-11').items.find(i=>i.id==='injury');
  assert.equal(rule.from,'2026-08');assert.equal(rule.verified,false);
  assert.ok(rule.sources.some(s=>s.url.includes('20260716_7178672')));
  assert.throws(()=>resolvePolicy(id,'2026-07'),e=>e.code==='tax.policyMissing');
 }
});

const component=(cityId,id,month)=>{const matches=cities.find(c=>c.id===cityId).periods.flatMap(p=>p.items).filter(i=>i.id===id&&i.from<=month&&i.to>=month);assert.equal(matches.length,1,`${cityId} ${id} ${month}`);return matches[0];};
test('Xian medical candidate applies the twelve-month employer reduction only through November 2026',()=>{
 for(const month of ['2026-07','2026-10','2026-11']){
  const rule=component('xian','medical',month);
  assert.equal(rule.employer,'0.07');assert.equal(rule.verification,'reference');
  const r=calculateContributions({salary:'10000'},{custom:true,month,items:[rule,component('xian','maternity',month)]});
  assert.equal(r.employeeTotal,'201.60');assert.equal(r.employerTotal,'706.40');
 }
 assert.equal(component('xian','medical','2026-12').employer,'0.08');
 assert.throws(()=>calculateContributions({salary:'10000'},resolvePolicy('xian','2026-11')),e=>e.code==='insurance.unverified');
});
test('Fuzhou maternity candidate retains the separately charged 0.7 percent and shared July bases',()=>{
 const rule=component('fuzhou','maternity','2026-11');
 assert.equal(rule.mergedInto,undefined);assert.equal(rule.employee,'0');assert.equal(rule.employer,'0.007');
 assert.equal(rule.min,'4579');assert.equal(rule.max,'22893');assert.equal(rule.verification,'reference');
 const r=calculateContributions({salary:'10000'},{custom:true,month:'2026-11',items:[component('fuzhou','medical','2026-11'),rule]});
 assert.equal(r.employeeTotal,'200.00');assert.equal(r.employerTotal,'870.00');
 assert.throws(()=>calculateContributions({salary:'10000'},resolvePolicy('fuzhou','2026-11')),e=>e.code==='insurance.unverified');
});
test('published Shanghai and Nanjing first-half housing limits do not inherit second-half caps',()=>{
 for(const [cityId,min,max,amount] of [['shanghai','2690','37302','2611.00'],['nanjing','2660','41400','2898.00']]){
  for(const month of ['2026-01','2026-06']){
   const rule=component(cityId,'housing',month);assert.ok(rule,cityId+' '+month);
   assert.equal(rule.min,min);assert.equal(rule.max,max);assert.equal(rule.verification,'reference');
   const r=calculateContributions({salary:'99999'},{custom:true,month,items:[rule]});
   assert.equal(r.employeeTotal,amount);assert.equal(r.employerTotal,amount);
  }
 }
 assert.equal(component('shanghai','housing','2026-07').max,'37731');
 assert.equal(component('nanjing','housing','2026-07').max,'42400');
 for(const cityId of ['shanghai','nanjing'])assert.throws(()=>resolvePolicy(cityId,'2026-06'),e=>e.code==='tax.policyMissing');
});
test('Xian unverified medical bases stay unknown instead of borrowing three-insurance limits',()=>{
 for(const month of ['2026-07','2026-11','2026-12']){
  const rule=component('xian','medical',month);assert.equal(rule.min,null);assert.equal(rule.max,null);assert.equal(rule.verification,'reference');
 }
});
test('Guangzhou applies the September minimum only from September, including historical housing',()=>{
 for(const [month,min,employee,employer] of [['2026-07','2500','180.00','195.00'],['2026-08','2500','180.00','195.00'],['2026-09','2680','193.36','209.44'],['2026-11','2680','193.36','209.44']]){
  const items=['housing','unemployment'].map(id=>component('guangzhou',id,month));
  for(const rule of items){assert.equal(rule.min,min);assert.equal(rule.verification,'reference');}
  const r=calculateContributions({salary:'2500'},{custom:true,month,items});
  assert.equal(r.employeeTotal,employee);assert.equal(r.employerTotal,employer);
 }
 assert.throws(()=>calculateContributions({salary:'10000'},resolvePolicy('guangzhou','2026-11')),e=>e.code==='insurance.unverified');
});
test('Guangzhou housing follows the published per-side yuan rounding and preserves its cap',()=>{
 const rule=component('guangzhou','housing','2026-08');
 assert.equal(rule.min,'2500');assert.equal(rule.max,'41697');
 for(const [salary,each,both] of [['2550','179.00','358.00'],['99999','2919.00','5838.00']]){
  const r=calculateContributions({salary},{custom:true,month:'2026-08',items:[rule]});
  assert.equal(r.employeeTotal,each);assert.equal(r.employerTotal,each);assert.equal(r.housingCredit,both);
 }
});
test('city housing rates follow the published whole percentage steps on both sides',()=>{
 for(const [cityId,fraction] of [['beijing','.075'],['shanghai','.055']]){
  const p=resolvePolicy(cityId,'2026-11');
  for(const side of ['employee','employer'])assert.throws(()=>calculateContributions({salary:'10000',rates:{housing:{[side]:fraction}}},p),e=>e.code==='insurance.rateRange'&&e.field===`${side}-housing`);
  for(const whole of ['.05','.06','.07'])assert.equal(calculateContributions({salary:'10000',rates:{housing:{employee:whole,employer:whole}}},p).employeeHousing,new Intl.NumberFormat('en',{minimumFractionDigits:2,useGrouping:false}).format(Number(whole)*10000));
 }
 for(const cityId of ['beijing','shanghai','guangzhou'])assert.equal(component(cityId,'housing','2026-11').rateStep,'0.01');
});
test('explicit custom housing keeps user fractional rates instead of applying city steps',()=>{
 const p=resolvePolicy('shanghai','2026-11');
 const r=calculateContributions({salary:'10000',rates:{housing:{employee:'.055',employer:'.055'}}},{...p,custom:true});
 assert.equal(r.employeeHousing,'550.00');assert.equal(r.housingCredit,'1100.00');
});
test('Suzhou housing rounds each side upward to yuan instead of half-up',()=>{
 const rule=component('suzhou','housing','2026-11');
 assert.equal(rule.rounding,'up');assert.equal(rule.verification,'reference');
 for(const [salary,each] of [['10000','700.00'],['10001','701.00'],['40600','2842.00'],['99999','2842.00']]){
  const r=calculateContributions({salary},{custom:true,month:'2026-11',items:[rule]});
  assert.equal(r.employeeTotal,each);assert.equal(r.employerTotal,each);
 }
});
test('Chongqing medical candidate includes basic, large-medical and maternity employer shares once',()=>{
 const items=['medical','maternity'].map(id=>component('chongqing',id,'2026-11'));
 assert.equal(items[0].employer,'0.10');assert.equal(items[1].mergedInto,'medical');
 const r=calculateContributions({salary:'10000'},{custom:true,month:'2026-11',items});
 assert.equal(r.employerTotal,'1000.00');assert.equal(r.employeeTotal,'205.00');
 assert.equal(items[0].verification,'reference');
 assert.throws(()=>calculateContributions({salary:'10000'},resolvePolicy('chongqing','2026-11')),e=>e.code==='insurance.unverified');
});
test('Fuzhou and Jinan first-half housing candidates use their own published annual caps',()=>{
 for(const [cityId,min,max] of [['fuzhou','2195','31053'],['jinan','2400','32586']]){
  for(const month of ['2026-01','2026-06']){
   const rule=component(cityId,'housing',month);assert.equal(rule.min,min);assert.equal(rule.max,max);assert.equal(rule.verification,'reference');
  }
 }
 assert.equal(component('fuzhou','housing','2026-07').max,'32430');
 assert.equal(component('jinan','housing','2026-07').max,'33902');
});
test('Wuhan housing uses the calendar year while Sichuan and Hunan three-insurance bases retain annual attribution',()=>{
 for(const month of ['2026-01','2026-06','2026-07','2026-11']){
  const housing=component('wuhan','housing',month);assert.equal(housing.min,'2400');assert.equal(housing.max,'36072.25');assert.equal(housing.rateStep,'0.01');
  for(const [cityId,min,max] of [['chengdu','4699','23493'],['changsha','4106','20529']]){
   for(const id of ['pension','unemployment','injury']){
    const rule=component(cityId,id,month);assert.equal(rule.min,min);assert.equal(rule.max,max);assert.equal(rule.verification,'reference');
   }
  }
 }
 // Calendar-year attribution does not establish earlier medical bases or the month a catch-up payment was made.
 assert.throws(()=>resolvePolicy('chengdu','2026-01'),e=>e.code==='tax.policyMissing');
});
test('Xiamen housing cites its own official notice and keeps the published end of the housing year',()=>{
 for(const month of ['2026-07','2026-11','2027-06']){
  const rule=component('xiamen','housing',month);assert.equal(rule.min,'2265');assert.equal(rule.max,'32937');assert.equal(rule.to,'2027-06');
  assert.ok(rule.sources.some(s=>s.url==='https://gjj.xm.gov.cn/zcfg/zfgjjgwhwj/2026n/202606/t20260629_3003625.htm'));
  assert.equal(rule.verification,'reference');
 }
});
test('Tianjin housing records both published years instead of starting at the September social-insurance adjustment',()=>{
 for(const [month,min,max] of [['2026-01','2320','27861'],['2026-06','2320','27861'],['2026-07','2510','28917'],['2026-11','2510','28917'],['2027-06','2510','28917']]){
  const rule=component('tianjin','housing',month);assert.equal(rule.min,min);assert.equal(rule.max,max);assert.equal(rule.verification,'reference');
  assert.equal(rule.digits,0);assert.equal(rule.rounding,'half-up');
 }
 const rule=component('tianjin','housing','2026-11');
 const r=calculateContributions({salary:'10050'},{custom:true,month:'2026-11',items:[rule]});
 assert.equal(r.employeeTotal,'704.00');assert.equal(r.employerTotal,'704.00');assert.equal(r.housingCredit,'1408.00');
});
