import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { parsePages, processPdf } from '../src/tools/pdf/core.js';
import { unzipSync } from 'fflate';
async function fixture(widths) {const pdf=await PDFDocument.create();widths.forEach(w=>pdf.addPage([w,200]));return pdf.save();}
async function widths(bytes) {return (await PDFDocument.load(bytes)).getPages().map(p=>p.getWidth());}
test('page selection rejects typos, duplicates, reversed and out of bounds ranges',()=>{
  assert.deepEqual(parsePages('1-3,5',5),[0,1,2,4]);assert.deepEqual(parsePages('3,1,2',3),[2,0,1]);
  for(const s of ['0','2-1','1,,2','1,1','6','1a','1-3-4',''])assert.throws(()=>parsePages(s,5),{code:'pdf.rangeError'});
});
test('merge honors explicit file order',async()=>{
  const result=await processPdf({files:[{name:'b.pdf',bytes:await fixture([300])},{name:'a.pdf',bytes:await fixture([100,150])}],mode:'merge'});
  assert.deepEqual(await widths(result.bytes),[300,100,150]);assert.equal(result.pageCount,3);
});
test('extract, reorder and delete write exactly the requested pages',async()=>{
  const files=[{name:'a.pdf',bytes:await fixture([100,200,300,400])}];
  assert.deepEqual(await widths((await processPdf({files,mode:'extract',pages:'1-2,4'})).bytes),[100,200,400]);
  assert.deepEqual(await widths((await processPdf({files,mode:'reorder',pages:'4,2,1,3'})).bytes),[400,200,100,300]);
  assert.deepEqual(await widths((await processPdf({files,mode:'delete',pages:'2-3'})).bytes),[100,400]);
  await assert.rejects(processPdf({files,mode:'reorder',pages:'2,1'}),{code:'pdf.completeOrder'});
  await assert.rejects(processPdf({files,mode:'delete',pages:'1-4'}),{code:'pdf.empty'});
});
test('rotation adds selected rotation and split ZIP preserves every page',async()=>{
  const files=[{name:'a.pdf',bytes:await fixture([100,200,300])}];
  const rotated=await PDFDocument.load((await processPdf({files,mode:'rotate',pages:'2',rotation:90})).bytes);
  assert.deepEqual(rotated.getPages().map(p=>p.getRotation().angle),[0,90,0]);
  const split=await processPdf({files,mode:'split'}),entries=unzipSync(split.bytes);
  assert.deepEqual(Object.keys(entries),['page-1.pdf','page-2.pdf','page-3.pdf']);
  assert.deepEqual(await widths(entries['page-2.pdf']),[200]);
});
test('images produce distinct pages in supplied order with original or A4 geometry',async()=>{
  const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
  const files=[{name:'a.png',type:'image/png',bytes:png},{name:'b.png',type:'image/png',bytes:png}];
  const original=await PDFDocument.load((await processPdf({files,mode:'images',pageSize:'original'})).bytes);
  assert.equal(original.getPageCount(),2);assert.equal(original.getPage(0).getWidth(),1);
  const a4=await PDFDocument.load((await processPdf({files,mode:'images',pageSize:'a4',orientation:'landscape'})).bytes);
  assert.equal(a4.getPage(0).getWidth(),841.89);assert.equal(a4.getPage(0).getHeight(),595.28);
});
test('invalid images and encrypted PDFs produce explicit PDF-domain errors',async()=>{
  await assert.rejects(processPdf({mode:'images',files:[{name:'bad.png',bytes:new Uint8Array([1,2,3])}]}),{code:'pdf.imageDecode'});
  const encrypted=await PDFDocument.create();encrypted.addPage();encrypted.context.trailerInfo.Encrypt=encrypted.context.register(encrypted.context.obj({Filter:'Standard'}));
  await assert.rejects(processPdf({mode:'merge',files:[{name:'locked.pdf',bytes:await encrypted.save()}]}),{code:'pdf.encrypted'});
});
