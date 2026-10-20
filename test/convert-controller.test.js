import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversionController } from '../src/tools/convert/controller.js';

function fixture(create) {
  const workers=[], states=[];
  const controller=createConversionController({onState:s=>states.push(s),createWorker:create || (()=> {
    const worker={postMessage(data){this.input=data;},terminate(){this.terminated=true;}};
    workers.push(worker); return worker;
  })});
  return {controller,workers,states};
}
const request=(input='abc',options={})=>({toolId:'base64',input,options});
test('工具/参数变化立即失效，迟到的任务结果和错误不能恢复旧结果', () => {
  const {controller,workers,states}=fixture();
  controller.process(request()); const old=workers[0];
  controller.process(request('YQ==',{direction:'decode'}));
  assert.ok(old.terminated); assert.equal(states.at(-1).status,'pending');
  old.onmessage({data:{taskId:old.input.taskId,status:'ready',preview:'OLD'}});
  old.onerror({preventDefault(){},message:'late error'});
  assert.equal(states.at(-1).status,'pending');
  const current=workers[1];
  current.onmessage({data:{...current.input,status:'ready',preview:'a',blob:new Blob(['a'])}});
  assert.equal(states.at(-1).preview,'a'); assert.ok(current.terminated);
  controller.invalidate(); assert.equal(states.at(-1).status,'idle');
});
test('小文本延迟执行；文件、大文本手动执行；取消清理队列和进行中任务', async () => {
  const {controller,workers,states}=fixture();
  controller.process(request(),{auto:true,wait:10});
  controller.cancel(); await new Promise(r=>setTimeout(r,25));
  assert.equal(workers.length,0); assert.equal(states.at(-1).status,'cancelled');
  for(const input of ['中'.repeat(90000),new Blob(['file'])]) {
    controller.process(request(input),{auto:true,wait:1});
    assert.equal(states.at(-1).status,'idle'); assert.equal(workers.length,0);
  }
  controller.process(request(''),{auto:true,wait:1});
  await new Promise(r=>setTimeout(r,15));
  assert.equal(workers.length,1,'空输入是有效的编码和摘要输入');
  controller.cancel(); assert.ok(workers[0].terminated);
});
test('Worker 启动失败可恢复，文件原样发送且错误会释放 Worker', () => {
  const failure=fixture(()=>{throw new Error('blocked');});
  failure.controller.process(request()); assert.equal(failure.states.at(-1).status,'error');
  const {controller,workers,states}=fixture(); const input=new Blob([new Uint8Array([0,255])]);
  controller.process(request(input)); assert.equal(workers[0].input.input,input);
  workers[0].onerror({preventDefault(){},message:'failure'});
  assert.ok(workers[0].terminated); assert.equal(states.at(-1).status,'error');
  controller.process(request()); assert.equal(workers.length,2);
});
test('MD5 progress and item events retain the worker; only terminal completion releases it', () => {
  const events=[], states=[], workers=[];
  const controller=createConversionController({onState:s=>states.push(s),onEvent:e=>events.push(e),createWorker:()=>{const w={postMessage(data){this.input=data;},terminate(){this.terminated=true;}};workers.push(w);return w;}});
  controller.process({toolId:'md5',input:[],options:{mode:'files'}});
  const worker=workers[0],taskId=worker.input.taskId;
  worker.onmessage({data:{taskId,event:'progress',processedBytes:2}});
  worker.onmessage({data:{taskId,event:'item-complete',itemId:'0',item:{hex:'abc'}}});
  assert.equal(events.length,2);assert.equal(states.at(-1).status,'pending');assert.ok(!worker.terminated);
  worker.onmessage({data:{taskId,event:'task-complete',status:'ready',items:[]}});
  assert.ok(worker.terminated);assert.equal(states.at(-1).status,'ready');
  worker.onmessage({data:{taskId,event:'progress',processedBytes:999}});
  assert.equal(events.length,2,'terminal worker events cannot revive the task');
  controller.process({toolId:'md5',input:[],options:{mode:'files'}});
  controller.cancel();
  workers[1].onmessage({data:{taskId:workers[1].input.taskId,event:'item-complete',item:{hex:'late'}}});
  assert.equal(events.length,2);assert.equal(states.at(-1).status,'cancelled');
});
test('MD5 empty input only runs manually; existing converters retain empty-input auto behavior', async () => {
  const {controller,workers}=fixture();
  controller.process({toolId:'md5',input:'',options:{}},{auto:true,wait:1});
  await new Promise(r=>setTimeout(r,10));assert.equal(workers.length,0);
  controller.process({toolId:'md5',input:'',options:{}});assert.equal(workers.length,1);
});
