import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { processText, limits } from '../src/tools/text/core.js';
import { processPdf } from '../src/tools/pdf/core.js';

test('URL extraction removes only approved outer punctuation before deduplication',async()=>{
 const input='[手册](https://e.test/a_(b)) https://e.test/a(b). https://e.test/a.,;:!，。；：！？、 https://e.test/a https://e.test/q?a=b. https://e.test/a#part! <https://e.test/a.> https://e.test/a%29 https://e.test/a[b]';
 const result=await processText({input,operation:'extract',kind:'url',dedupe:true});
 assert.equal(await result.blob.text(),'https://e.test/a_(b)\nhttps://e.test/a(b)\nhttps://e.test/a\nhttps://e.test/q?a=b.\nhttps://e.test/a#part!\nhttps://e.test/a.\nhttps://e.test/a%29\nhttps://e.test/a[b]');
 assert.equal(result.summary.matches,9);assert.equal(result.summary.items,8);
});

test('replacement retains complete 100 MiB output, including its final bytes',async()=>{
 const replacement='a'.repeat(limits.output-4)+'终!';
 const result=await processText({input:'x',operation:'replace',find:'x',replacement});
 assert.equal(result.status,'ready');assert.equal(result.outputBytes,limits.output);
 assert.equal(await result.blob.slice(-4).text(),'终!');
 assert.equal(createHash('sha256').update(new Uint8Array(await result.blob.arrayBuffer())).digest('hex'),createHash('sha256').update(replacement).digest('hex'));
 assert.equal((await processText({input:'x',operation:'replace',find:'x',replacement:replacement+'!'})).code,'text.outputLimit');
});

test('single-source PDF filenames preserve Chinese stem and all operation content',async()=>{
 const doc=await PDFDocument.create();[100,200,300].forEach(width=>doc.addPage([width,400]));
 const files=[{name:'中文 手册.v2.PDF',bytes:await doc.save()}];
 for(const [mode,pages,widths] of [['extract','3,1',[300,100]],['reorder','3,1,2',[300,100,200]],['delete','2',[100,300]],['rotate','2',[100,200,300]],['merge','',[100,200,300]]]){
  const result=await processPdf({files,mode,pages,rotation:90});assert.equal(result.name,`中文 手册.v2-${mode}.pdf`);
  const output=await PDFDocument.load(result.bytes);assert.deepEqual(output.getPages().map(page=>page.getWidth()),widths);
  if(mode==='rotate')assert.deepEqual(output.getPages().map(page=>page.getRotation().angle),[0,90,0]);
 }
 const split=await processPdf({files,mode:'split'});assert.equal(split.name,'中文 手册.v2-split.zip');
 const entries=unzipSync(split.bytes);assert.deepEqual(Object.keys(entries),['page-1.pdf','page-2.pdf','page-3.pdf']);
 assert.equal((await PDFDocument.load(entries['page-3.pdf'])).getPage(0).getWidth(),300);
 const merged=await processPdf({files:[...files,{name:'另一份.pdf',bytes:await doc.save()}],mode:'merge'});assert.equal(merged.name,'merged.pdf');assert.equal((await PDFDocument.load(merged.bytes)).getPageCount(),6);
});

for(const [input,want]of [
 ['https://e.test/a?!!','https://e.test/a?!!'],
 ['https://e.test/a?;','https://e.test/a?;'],
 ['https://e.test/a?','https://e.test/a'],
 ['[手册](https://e.test/a_(b)).','https://e.test/a_(b)'],
 ['[手册](https://e.test/a?q=!!).','https://e.test/a?q=!!']
])test(`URL query and Markdown boundary: ${input}`,async()=>{
 const result=await processText({input,operation:'extract',kind:'url'});assert.equal(await result.blob.text(),want);
});
