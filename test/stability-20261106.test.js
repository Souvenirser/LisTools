import {test} from 'node:test';import assert from 'node:assert/strict';
import {processText} from '../src/tools/text/core.js';import {calculateWage} from '../src/tools/payroll/tax.js';
test('first employer month rejects nonzero historical totals',()=>{assert.throws(()=>calculateWage({mode:'actual',month:1,startMonth:1,salary:'10000',previous:{income:'100000',basic:'60000'}}),e=>e.code==='tax.firstMonthHistory');});
for(const [input,want]of [
 ['请看 https://e.test/help，更多说明。','https://e.test/help'],
 ['请看（网址：https://e.test/help）。','https://e.test/help'],
 ['[手册](https://e.test/a_(b))','https://e.test/a_(b)'],
 ['https://e.test/?q=a,b.','https://e.test/?q=a,b.'],
 ['<https://e.test/文件，第一版>','https://e.test/文件，第一版'],
 ['https://e.test/中文%20路径','https://e.test/中文%20路径']
])test('extract URL '+input,async()=>{const r=await processText({input,operation:'extract',kind:'url'});assert.equal(r.status,'ready');assert.equal(await r.blob.text(),want);});
import {resolvePolicy} from '../src/tools/payroll/policy.js';
test('official corrections preserve city blocking and dated medical boundaries',()=>{
 assert.equal(resolvePolicy('guangzhou','2026-11').items.find(i=>i.id==='medical').employer,'0.0685');
 assert.equal(resolvePolicy('suzhou','2026-11').items.find(i=>i.id==='housing').rounding,'up');
 assert.throws(()=>resolvePolicy('changsha','2026-09'),e=>e.code==='tax.policyMissing');
 assert.throws(()=>resolvePolicy('jinan','2026-08'),e=>e.code==='tax.policyMissing');
 assert.ok(resolvePolicy('guangzhou','2026-11').items.some(i=>!i.verified));
});
for(const [input,want]of [
 ['（网址：https://e.test/?q=a,b.）','https://e.test/?q=a,b.'],
 ['(URL: https://e.test/a_(b)?q=1)','https://e.test/a_(b)?q=1'],
 ['https://e.test/?q=a)tail','https://e.test/?q=a)tail'],
 ['https://e.test/a(b).','https://e.test/a(b)'],
 ['https://e.test/中文#片段，保留','https://e.test/中文#片段，保留']
])test('URL context '+input,async()=>assert.equal(await (await processText({input,operation:'extract',kind:'url'})).blob.text(),want));
for(const [input,want]of [
 ['https://e.test/a，https://e.test/b','https://e.test/a\nhttps://e.test/b'],
 ['[手册](https://e.test/a_(b))，另见https://e.test/c','https://e.test/a_(b)\nhttps://e.test/c'],
 ['https://e.test/?next=https://other.test/a','https://e.test/?next=https://other.test/a']
])test('multiple URL boundaries '+input,async()=>{const r=await processText({input,operation:'extract',kind:'url'});assert.equal(await r.blob.text(),want);assert.equal(r.summary.matches,want.split('\n').length);});

test('later query URL does not absorb preceding prose',async()=>{const r=await processText({input:'https://e.test/a，另见https://e.test/b?q=a,b.',operation:'extract',kind:'url'});assert.equal(await r.blob.text(),'https://e.test/a\nhttps://e.test/b?q=a,b.');});
test('rescanned URL candidates retain the extraction cap and pre-dedup count',async()=>{const r=await processText({input:Array(10001).fill('https://e.test/a').join('，'),operation:'extract',kind:'url',dedupe:true});assert.equal(await r.blob.text(),'https://e.test/a');assert.equal(r.summary.matches,10000);assert.equal(r.summary.items,1);assert.equal(r.truncated,true);});
