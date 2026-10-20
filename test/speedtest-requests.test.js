import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeedRequestGuard } from '../src/tools/speedtest/requests.js';

test('every request including loaded-latency body reads has its own deadline',async()=>{
  const guard=createSpeedRequestGuard(async(_url,{signal})=>({ok:true,text:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}),{timeoutMs:15});
  try {
    const response=await guard.fetch('https://speed.cloudflare.com/__down?bytes=0&during=downloadload');
    await assert.rejects(response.text(),error=>error.name==='TimeoutError');
  } finally {guard.dispose();}
});
test('guard forbids other endpoints and forces credential omission',async()=>{
  let options;
  const guard=createSpeedRequestGuard(async(_url,init)=>{options=init;return {ok:true,text:async()=>''};});
  try {
    await assert.rejects(guard.fetch('https://speed.cloudflare.com/__results'));
    await assert.rejects(guard.fetch('https://example.com/__down'));
    const response=await guard.fetch('https://speed.cloudflare.com/__up',{method:'POST',body:'test',credentials:'include',headers:{Authorization:'must-not-send'}});
    await response.text();assert.equal(options.credentials,'omit');assert.equal(options.headers.has('authorization'),false);
    assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');
  }finally{guard.dispose();}
});
test('SDK cancellation and guard disposal abort pending network operations',async()=>{
  const signals=[];
  const guard=createSpeedRequestGuard(async(_url,{signal})=>{signals.push(signal);return {ok:true,text:async()=>''};});
  const sdk=new AbortController();await guard.fetch('https://speed.cloudflare.com/__down?bytes=0',{signal:sdk.signal});
  sdk.abort();assert.equal(signals[0].aborted,true);
  await guard.fetch('https://speed.cloudflare.com/__down?bytes=0');guard.dispose();assert.equal(signals[1].aborted,true);
  await assert.rejects(guard.fetch('https://speed.cloudflare.com/__down'));
});
