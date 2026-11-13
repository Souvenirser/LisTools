import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {calculateContributions} from '../src/tools/payroll/contributions.js';
import {resolveReferencePolicy} from '../src/tools/payroll/policy.js';

const requiredMonths=Array.from({length:11},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`);
export function assertPayrollReleaseReady(review,cityIds,policySha256){
 assert.equal(review.version,'1.2.8','wrong payroll review version');
 assert.equal(review.policySha256,policySha256,'payroll review snapshot does not match policy data');
 assert.deepEqual(review.cities.map(c=>c.id).sort(),[...cityIds].sort(),'payroll review city coverage differs');
 const pending=review.cities.flatMap(city=>{
  const missing=requiredMonths.filter(month=>!city.verifiedMonths.includes(month));
  return missing.length||city.blockers.length?[`${city.id}: ${missing.join(', ')}; ${city.blockers.join('; ')}`]:[];
 });
 assert.equal(pending.length,0,'v1.2.8 政策核验未完成，禁止正式出包：\n'+pending.join('\n'));
}
// The user selected a reference-estimate edition; official verification stays separate.
export function assertReferenceReleaseReady(review,data,cityIds,sha256){
 assert.equal(review.version,'1.2.8');assert.equal(review.edition,'reference');
 assert.equal(review.referenceSha256,sha256,'reference snapshot does not match review');
 assert.equal(review.capturedAt,data.capturedAt);assert.equal(review.officiallyVerified,false);
 assert.deepEqual(data.cities.map(c=>c.id).sort(),[...cityIds].sort(),'reference city coverage differs');
 for(const city of data.cities){
  assert.equal(city.sourceUrl,`https://sbjsq.tixiaolu.com/${city.id}/`,'reference source URL differs');
  assert.match(city.sourceSha256,/^[a-f0-9]{64}$/,'reference source hash missing');
  const cases=review.cases.filter(c=>c.cityId===city.id);
  assert.equal(cases.length,3,`${city.id}: reference cases missing`);
  assert.deepEqual(cases.map(c=>c.salary),['1','10000','999999'],`${city.id}: boundary cases missing`);
  for(const c of cases){const r=calculateContributions({salary:c.salary},resolveReferencePolicy(city.id,'2026-11'));for(const key of ['employeeTotal','employerTotal'])assert.equal(r[key],c[key],`${city.id}: reference amount differs`);}
 }
}
export async function checkPayrollRelease(){
 const raw=await readFile(new URL('../src/tools/payroll/reference-cities.json',import.meta.url)),catalog=JSON.parse(await readFile(new URL('../src/tools/payroll/cities.json',import.meta.url),'utf8'));
 const review=JSON.parse(await readFile(new URL('../docs/payroll-reference-v128-audit.json',import.meta.url),'utf8'));
 assertReferenceReleaseReady(review,JSON.parse(raw),catalog.cities.map(c=>c.id),createHash('sha256').update(raw).digest('hex'));
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkPayrollRelease();
