import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

async function request(data) {
  const workerUrl=new URL('../src/tools/cron/worker.js',import.meta.url).href;
  const source=`import { parentPort } from 'node:worker_threads'; globalThis.self={postMessage:data=>parentPort.postMessage(data)}; await import(${JSON.stringify(workerUrl)}); parentPort.on('message',data=>self.onmessage({data}));`;
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`));
  try {
    const result=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
    worker.postMessage(data); return await result;
  } finally { await worker.terminate(); }
}

test('Cron module worker returns validated dates, locale description and original task identity', async () => {
  const result=await request({taskId:42,input:'0 0 9 ? * 1',options:{dialect:'quartz',timeZone:'UTC',reference:'2026-01-01T00:00:00Z',count:10,language:'zh-Hans'}});
  assert.equal(result.taskId,42); assert.equal(result.status,'ready'); assert.equal(result.dates.length,10);
  assert.equal(result.dates[0].utcTime,'2026-01-04T09:00:00.000Z'); assert.match(result.description,/星期日|周日/);
});

test('Cron worker returns structured field errors without producing stale dates', async () => {
  const result=await request({taskId:43,input:'61 * * * *',options:{dialect:'linux'}});
  assert.equal(result.taskId,43); assert.equal(result.status,'error'); assert.equal(result.field,'minute'); assert.equal(result.dates,undefined);
});

test('L-n with wildcard seconds jumps across nonmatching days within the worker deadline', async () => {
  const workerUrl=new URL('../src/tools/cron/worker.js',import.meta.url).href;
  const source=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(workerUrl)});parentPort.on('message',data=>self.onmessage({data}));`;
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`));
  let timer;
  try {
    const resultPromise=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);timer=setTimeout(()=>reject(new Error('L-n calculation exceeded 2 seconds')),2000);});
    worker.postMessage({taskId:44,input:'* * * L-3 * ?',options:{dialect:'quartz',timeZone:'UTC',reference:'2026-01-01T00:00:00Z',count:10}});
    const result=await resultPromise;
    assert.equal(result.status,'ready');assert.equal(result.dates[0].utcTime,'2026-01-28T00:00:00.000Z');assert.equal(result.dates[1].utcTime,'2026-01-28T00:00:01.000Z');
  } finally {clearTimeout(timer);await worker.terminate();}
});
