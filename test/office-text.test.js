import test from 'node:test';
import assert from 'node:assert/strict';
import { countText, processText } from '../src/tools/text/core.js';
test('counts grapheme clusters, locale words, CRLF lines and UTF8 bytes',()=>{
 assert.deepEqual(countText('👨‍👩‍👧‍👦 e\u0301\r\nhello','en'),{graphemes:9,words:2,lines:2,bytes:36});
 assert.equal(countText('').lines,0);
});
test('literal replacement does not interpret dollar tokens and extraction deduplicates',async()=>{
 assert.equal((await processText({input:'a.a',operation:'replace',find:'.',replacement:'$&'})).preview,'a$&a');
 assert.equal((await processText({input:'a@example.com a@example.com b@example.org',operation:'extract',kind:'email',dedupe:true})).preview,'a@example.com\nb@example.org');
});
test('reuses conversion operations and masks selected types only',async()=>{
 assert.equal((await processText({input:'foo bar',operation:'case',style:'camel'})).preview,'fooBar');
 assert.equal((await processText({input:'13812345678 a@example.com 110101199001011234',operation:'mask',phone:true,email:false,id:true})).preview,'138****5678 a@example.com 110101********1234');
});
test('empty find and excessive input fail with localizable errors',async()=>{
 assert.equal((await processText({input:'x',operation:'replace',find:''})).code,'text.emptyFind');
 assert.equal((await processText({input:'a'.repeat(10*1024**2+1)})).code,'text.inputLimit');
});
test('line cleanup preserves surviving endings and explicit newline conversion',async()=>{
 assert.equal((await processText({input:'b\r\na\r\na\r\n',operation:'lines',lineOperation:'dedupe'})).preview,'b\r\na\r\n');
 assert.equal((await processText({input:'a\rb\r\nc\n',operation:'newline',ending:'lf'})).preview,'a\nb\nc\n');
});
test('extraction uses embedded format boundaries and reports match truncation',async()=>{
 const result=await processText({input:'x 13812345678 1138123456789 https://example.com/a a+b@example.org',operation:'extract',kind:'phone'});assert.equal(result.preview,'13812345678');
 const many=await processText({input:'13812345678 '.repeat(10001),operation:'extract',kind:'phone',dedupe:true});assert.equal(many.preview,'13812345678');assert.equal(many.truncated,true);
});
test('operation summaries use full processed content without changing exports',async()=>{
 const lines=await processText({input:'a\nb\na',operation:'lines',lineOperation:'dedupe'});assert.deepEqual(lines.summary,{inputLines:3,outputLines:2});assert.equal(await lines.blob.text(),'a\nb');
 const extract=await processText({input:'a@example.com a@example.com',operation:'extract',kind:'email',dedupe:true});assert.equal(extract.summary.matches,2);assert.equal(extract.summary.items,1);
 const replace=await processText({input:'a.a.a',operation:'replace',find:'.',replacement:'-'});assert.equal(replace.summary.replacements,2);
 const mask=await processText({input:'13812345678',operation:'mask',phone:true});assert.equal(mask.summary.masked,1);
});
