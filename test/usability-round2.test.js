import test from 'node:test';
import assert from 'node:assert/strict';
import {businessDays} from '../src/tools/dates/core.js';
import {processText,limits} from '../src/tools/text/core.js';

test('N2 business days respect original endpoints in either direction',()=>{
 const off=['2026-10-14','2026-10-17'],work=['2026-10-17'];
 function oracle(start,end,inclusive){const a=Date.parse(start),b=Date.parse(end),step=a>b?-86400000:86400000;let total=0;for(let d=a;step>0?d<b+(inclusive?step:0):d>b+(inclusive?step:0);d+=step){const key=new Date(d).toISOString().slice(0,10),day=new Date(d).getUTCDay();if(work.includes(key)||(!off.includes(key)&&day>0&&day<6))total++;}return (a>b?-1:1)*total;}
 assert.equal(businessDays('2026-10-18','2026-10-12'),-4);
 for(let a=1;a<=23;a++)for(let b=1;b<=23;b++)for(const inclusive of [false,true]){const start=`2026-10-${String(a).padStart(2,'0')}`,end=`2026-10-${String(b).padStart(2,'0')}`;assert.equal(businessDays(start,end,{off,work,inclusive}),oracle(start,end,inclusive),`${start} ${end} ${inclusive}`);}
});
test('N6 replacement checks actual UTF8 bytes at the output limit',async()=>{
 const input='a'.repeat(102400);
 for(const [replacement,want] of [['b'.repeat(1024),'ready'],['b'.repeat(1024)+'x','error'],['界'.repeat(341)+'b','ready']]){const result=await processText({input,operation:'replace',find:'a',replacement});assert.equal(result.status,want);if(want==='ready')assert.equal(result.blob.size,limits.output);}
 for(const [input,want,bytes]of [['a'.repeat(102399)+'x'.repeat(1023),'ready',limits.output-1],['a'.repeat(102400)+'x','error',limits.output+1]]){const result=await processText({input,operation:'replace',find:'a',replacement:'b'.repeat(1024)});assert.equal(result.status,want);if(want==='ready')assert.equal(result.blob.size,bytes);}
 const result=await processText({input:'界'.repeat(102400),operation:'replace',find:'界',replacement:'b'.repeat(1024)});assert.equal(result.status,'ready');assert.equal(result.blob.size,limits.output);
});
