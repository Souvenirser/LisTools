import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';

test('实际 Worker 返回任务 ID、完整 Blob 和限长预览，取消后不发回旧结果', async () => {
  const worker=new Worker(new URL('./helpers/convert-worker.js',import.meta.url));
  try {
    const response=once(worker,'message');
    worker.postMessage({taskId:17,toolId:'base64',input:new Blob(['中文🙂']),options:{}});
    const [result]=await response;
    assert.equal(result.taskId,17);assert.equal(result.status,'ready',result.message);
    assert.equal(await result.blob.text(),Buffer.from('中文🙂').toString('base64'));
  } finally {await worker.terminate();}
  const cancelled=new Worker(new URL('./helpers/convert-worker.js',import.meta.url));
  let delivered=false;cancelled.on('message',()=>{delivered=true;});
  cancelled.postMessage({taskId:18,toolId:'hash',input:new Blob([new Uint8Array(50*1024**2)]),options:{algorithm:'sha512'}});
  await cancelled.terminate();assert.equal(delivered,false);
});
test('实际 Worker 隔离非法输入，后续新任务可成功', async () => {
  const worker=new Worker(new URL('./helpers/convert-worker.js',import.meta.url));
  try {
    let response=once(worker,'message');
    worker.postMessage({taskId:20,toolId:'hex',input:'xyz',options:{direction:'decode'}});
    assert.equal((await response)[0].status,'error');
    response=once(worker,'message');
    worker.postMessage({taskId:21,toolId:'hash',input:'abc',options:{algorithm:'sha256'}});
    assert.equal((await response)[0].status,'ready');
  } finally {await worker.terminate();}
});
test('缺少新版 TypedArray Base64 API 时使用库的回退实现，1 MiB 往返仍完整', async () => {
  const worker=new Worker(new URL('./helpers/convert-worker.js',import.meta.url),{workerData:{legacyBase64:true}});
  try {
    const bytes=Uint8Array.from({length:1024**2},(_,i)=>i%256);
    let response=once(worker,'message');worker.postMessage({taskId:31,toolId:'base64',input:new Blob([bytes]),options:{}});
    const encoded=(await response)[0];assert.equal(encoded.status,'ready',encoded.message);
    const text=await encoded.blob.text();assert.equal(text,Buffer.from(bytes).toString('base64'));
    response=once(worker,'message');worker.postMessage({taskId:32,toolId:'base64',input:new Blob([text]),options:{direction:'decode'}});
    const decoded=(await response)[0];assert.equal(decoded.status,'ready',decoded.message);
    assert.deepEqual(new Uint8Array(await decoded.blob.arrayBuffer()),bytes);
  } finally {await worker.terminate();}
});

test('MD5 worker streams queue events with task and item IDs before terminal completion', async () => {
  const worker=new Worker(new URL('./helpers/convert-worker.js',import.meta.url));const events=[];
  try {
    const completed=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{events.push(data);if(data.event==='task-complete')resolve(data);});});
    worker.postMessage({taskId:101,toolId:'md5',input:[new Blob(['abc']),new Blob([])],options:{mode:'files'}});
    const result=await completed;
    assert.equal(result.status,'ready');assert.equal(result.items[0].hex,'900150983cd24fb0d6963f7d28e17f72');assert.equal(result.items[1].hex,'d41d8cd98f00b204e9800998ecf8427e');
    assert.ok(events.every(event=>event.taskId===101));assert.equal(events.filter(event=>event.event==='item-complete').length,2);
    assert.ok(events.filter(event=>event.event==='progress').every(event=>typeof event.itemId==='string'));
    assert.equal(events.at(-1).event,'task-complete');
  } finally {await worker.terminate();}
});
