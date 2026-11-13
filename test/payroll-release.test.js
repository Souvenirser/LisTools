import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPayrollReleaseReady} from '../scripts/payroll-release.js';

const months=Array.from({length:11},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`);
const ready=()=>({version:'1.2.8',policySha256:'fixture',cities:[{id:'example',verifiedMonths:months,blockers:[]}]});
test('1.2.8 packaging requires the reviewed policy snapshot and every agreed month',()=>{
 assert.doesNotThrow(()=>assertPayrollReleaseReady(ready(),['example'],'fixture'));
 const missing=ready();missing.cities[0].verifiedMonths=months.slice(1);
 assert.throws(()=>assertPayrollReleaseReady(missing,['example'],'fixture'),/example.*2026-01/);
 assert.throws(()=>assertPayrollReleaseReady(ready(),['example'],'changed'),/snapshot/);
});
test('a city label or an unresolved policy review cannot satisfy the release gate',()=>{
 const pending=ready();pending.cities[0].blockers=['rounding evidence missing'];
 assert.throws(()=>assertPayrollReleaseReady(pending,['example'],'fixture'),/example.*rounding/);
 assert.throws(()=>assertPayrollReleaseReady(ready(),['example','missing'],'fixture'),/city/);
});

test('reference edition packaging requires a matching snapshot, source coverage, and executable cases',async()=>{
 const {assertReferenceReleaseReady}=await import('../scripts/payroll-release.js');
 assert.equal(typeof assertReferenceReleaseReady,'function');
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const raw=await readFile(new URL('../src/tools/payroll/reference-cities.json',import.meta.url)),data=JSON.parse(raw),sha=createHash('sha256').update(raw).digest('hex');
 const review=JSON.parse(await readFile(new URL('../docs/payroll-reference-v128-audit.json',import.meta.url),'utf8'));
 assert.doesNotThrow(()=>assertReferenceReleaseReady(review,data,data.cities.map(c=>c.id),sha));
 assert.throws(()=>assertReferenceReleaseReady(review,data,data.cities.map(c=>c.id),'wrong'),/snapshot/);
 const missing=structuredClone(review);missing.cases=missing.cases.filter(c=>c.cityId!==data.cities[0].id);
 assert.throws(()=>assertReferenceReleaseReady(missing,data,data.cities.map(c=>c.id),sha),/case/);
 const altered=structuredClone(review);altered.cases[0].employeeTotal='0.00';
 assert.throws(()=>assertReferenceReleaseReady(altered,data,data.cities.map(c=>c.id),sha),/amount/);
 const unsourced=structuredClone(data);unsourced.cities[0].sourceSha256='';
 assert.throws(()=>assertReferenceReleaseReady(review,unsourced,data.cities.map(c=>c.id),sha),/source/);
});
