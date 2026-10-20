import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {createConversionController} from '../src/tools/convert/controller.js';

function actualWorker() {
  const url=new URL('../src/tools/regex/worker.js',import.meta.url);
  const code=`import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(url.href)});parentPort.on('message',data=>self.onmessage({data}));`;
  return new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`));
}
function bridge(worker) {
  const wrapper={postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate()};
  worker.on('message',data=>wrapper.onmessage?.({data}));
  worker.on('error',error=>wrapper.onerror?.({preventDefault(){},message:error.message}));
  return wrapper;
}
test('actual regex Worker preserves task ID, full result and capture metadata',async()=> {
  const worker=actualWorker();
  try {
    const response=once(worker,'message');
    worker.postMessage({taskId:42,pattern:'(?<letter>a)',flags:'g',input:'a a',operation:'replace',replacement:'$<letter>!'});
    const [result]=await response;
    assert.equal(result.taskId,42);assert.equal(result.status,'ready',result.message);
    assert.equal(await result.blob.text(),'a! a!');assert.equal(result.matches[1].index,2);
    assert.equal(result.matches[0].namedGroups.letter.value,'a');
  } finally {await worker.terminate();}
});
test('a catastrophic native regex is terminated at the 2-second deadline and a subsequent task succeeds',async()=> {
  const workers=[],states=[];let done;
  const settled=new Promise(resolve=>{done=resolve;});
  const controller=createConversionController({timeoutMs:2000,createWorker:()=>{const worker=actualWorker();workers.push(worker);return bridge(worker);},onState:state=>{states.push(state);if(state.status==='error') done(state);}});
  try {
    const started=performance.now();
    controller.process({pattern:'(a+)+$',flags:'g',input:'a'.repeat(32)+'!'});
    const result=await Promise.race([settled,new Promise((_,reject)=>setTimeout(()=>reject(new Error('regex timeout did not fire')),4000).unref())]);
    assert.equal(result.code,'TaskTimeout');assert.ok(performance.now()-started<3500);
    let nextDone;const nextResult=new Promise(resolve=>{nextDone=resolve;});
    const next=createConversionController({createWorker:()=>bridge(actualWorker()),onState:state=>{if(state.status==='ready') nextDone(state);}});
    next.process({pattern:'a',flags:'g',input:'ba'});
    assert.equal((await nextResult).matches[0].index,1);
    assert.equal(states.filter(state=>state.status==='ready').length,0);
  } finally {controller.cancel();await Promise.all(workers.map(worker=>worker.terminate()));}
});
test('input changes and cancellation clear prior results and discard stale task callbacks',()=> {
  const workers=[],states=[];
  const controller=createConversionController({createWorker:()=>{const worker={postMessage(data){this.request=data;},terminate(){}};workers.push(worker);return worker;},onState:state=>states.push(state)});
  controller.process({pattern:'a',flags:'g',input:'a'});const previous=workers[0];
  controller.process({pattern:'b',flags:'g',input:'b'});const active=workers[1];
  previous.onmessage({data:{taskId:previous.request.taskId,status:'ready',preview:'stale'}});
  assert.equal(states.at(-1).status,'pending');
  active.onmessage({data:{taskId:active.request.taskId,status:'ready',preview:'b'}});
  assert.equal(states.at(-1).preview,'b');
  controller.cancel();active.onmessage({data:{taskId:active.request.taskId,status:'ready',preview:'late'}});
  assert.equal(states.at(-1).status,'cancelled');
});
