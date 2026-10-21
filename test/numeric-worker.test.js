import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { createConversionController } from '../src/tools/convert/controller.js';
function workerAdapter(){
  const workerUrl=new URL('../src/tools/calculator/worker.js',import.meta.url).href;
  const source=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(workerUrl)});parentPort.on('message',data=>self.onmessage({data}));`;
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`));
  const adapter={postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate()};
  worker.on('message',data=>adapter.onmessage?.({data}));worker.on('error',error=>adapter.onerror?.({preventDefault(){},message:error.message}));return adapter;
}
async function request(data){const worker=workerAdapter();try{return await new Promise((resolve,reject)=>{worker.onmessage=({data})=>resolve(data);worker.onerror=reject;worker.postMessage(data);});}finally{worker.terminate();}}
test('calculator worker returns precision result and structured validation error',async()=>{
  const result=await request({taskId:9,input:'200 + 10%'});assert.equal(result.taskId,9);assert.equal(result.result.exact,'220');
  const failure=await request({taskId:10,input:'x=1'});assert.equal(failure.status,'error');assert.equal(failure.code,'calculator.notAllowed');assert.equal(failure.result,undefined);
});
test('calculator worker carries scientific context and remains usable after domain errors',async()=>{
  const worker=workerAdapter();
  const send=data=>new Promise(resolve=>{worker.onmessage=({data})=>resolve(data);worker.postMessage(data);});
  try {
    const failure=await send({taskId:20,input:'tan(pi/2)',angleUnit:'rad'});assert.equal(failure.code,'calculator.tanUndefined');assert.equal(failure.taskId,20);
    const result=await send({taskId:21,input:'sin(pi/2)+Ans',angleUnit:'rad',ans:'0.3'});assert.equal(result.result.exact,'1.3');assert.deepEqual(result.result.context,{angleUnit:'rad',ans:'0.3'});
    const business=await send({taskId:22,mode:'growth',first:'100',second:'120'});assert.equal(business.result.exact,'20');
  } finally {worker.terminate();}
});
test('calculator invalidation and cancellation cannot publish a running worker result',async()=>{
  const states=[];const controller=createConversionController({createWorker:workerAdapter,onState:state=>states.push(state),timeoutMs:2000});
  controller.process({input:'9^99999'});controller.invalidate();
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(states.at(-1).status,'idle');assert.equal(states.some(state=>state.status==='ready'),false);
  controller.process({input:'1+1'});controller.cancel();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(states.at(-1).status,'cancelled');assert.equal(states.some(state=>state.status==='ready'),false);
});
test('calculator controller deadline terminates work with no later result',async()=>{
  const states=[];const controller=createConversionController({createWorker:workerAdapter,onState:state=>states.push(state),timeoutMs:1});
  controller.process({input:'1+1'});await new Promise(resolve=>setTimeout(resolve,40));assert.equal(states.at(-1).status,'error');assert.equal(states.at(-1).code,'TaskTimeout');assert.equal(states.some(state=>state.status==='ready'),false);
});
