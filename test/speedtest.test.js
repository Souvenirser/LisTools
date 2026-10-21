import test from 'node:test';
import assert from 'node:assert/strict';
import { speedConfig, plannedBytes, readResults } from '../src/tools/speedtest/core.js';
import * as speedCore from '../src/tools/speedtest/core.js';
import { readFileSync } from 'node:fs';
import { languages } from '../src/i18n-core.js';
import { createSpeedTestController } from '../src/tools/speedtest/controller.js';

test('speed levels distinguish all seven raw throughput boundaries without rounding',()=>{
  assert.equal(typeof speedCore.speedLevelFor,'function');
  for(const [bps,id] of [[0,'walking'],[999999,'walking'],[1000000,'bicycle'],[4999999,'bicycle'],[5000000,'motorcycle'],[19999999,'motorcycle'],[20000000,'car'],[99999999,'car'],[100000000,'train'],[299999999,'train'],[300000000,'plane'],[999999999,'plane'],[1000000000,'rocket'],[8000000000,'rocket']])assert.equal(speedCore.speedLevelFor(bps)?.id,id,String(bps));
  for(const bps of [null,undefined,NaN,Infinity,-1,'1000000'])assert.equal(speedCore.speedLevelFor(bps),undefined);
});

test('speed rating labels cover all fifty languages with matching placeholders',()=>{
  const source=JSON.parse(readFileSync(new URL('../src/tools/speedtest/messages.json',import.meta.url),'utf8'));
  const parameters=value=>[...value.matchAll(/\{\{([^}]+)\}\}/g)].map(match=>match[1]).sort();
  for(const {code} of languages){
    const resource=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url),'utf8')).speedtestRating;
    assert.deepEqual(Object.keys(resource||{}).sort(),Object.keys(source).sort(),code);
    for(const [key,value] of Object.entries(source)){
      assert.ok(resource[key]?.trim(),`${code}/${key}`);assert.deepEqual(parameters(resource[key]),parameters(value),`${code}/${key}`);
      if(code==='en')assert.equal(resource[key],value,key);
    }
  }
});

test('both speed profiles disable telemetry and contain only fixed measurement endpoints',()=>{
  for(const profile of ['light','standard']) {
    const config=speedConfig(profile);
    assert.equal(config.autoStart,false);
    assert.equal(config.logAimApiUrl,null);assert.equal(config.logMeasurementApiUrl,null);
    assert.equal(config.includeCredentials,false);assert.equal(config.authorizationEnabled,false);
    assert.equal(config.authorizationToken,null);assert.equal(config.sessionId,undefined);
    assert.equal(config.bandwidthAbortRequestDuration,15000);
    assert.deepEqual(config.measurements[0],{type:'latency',numPackets:20});
    assert.ok(config.measurements.every(item=>['latency','download','upload'].includes(item.type)));
  }
  assert.equal(plannedBytes('light'),2*(100*1024*2+1024**2*2+5*1024**2));
  assert.equal(plannedBytes('standard'),2*(100*1024*2+1024**2*3+10*1024**2*3+25*1024**2*2));
  assert.throws(()=>speedConfig('unknown'));
});

test('no samples are represented as unavailable, not a measured zero',()=>{
  const empty=readResults();
  assert.equal(empty.metrics.downloadBps,null);
  assert.equal(empty.metrics.latencyMs,null);
  assert.equal(empty.metrics.jitterMs,null);
  assert.equal(empty.completedBytes,0);
});

test('only measurement statistics enter exported results',()=>{
  const results={
    getSummary:()=>({download:1234,upload:0,latency:0,jitter:9,downLoadedLatency:8,packetLoss:1,ip:'private-data'}),
    getDownloadBandwidthPoints:()=>[{bps:1234,bytes:1024,duration:20,measTime:new Date()}],
    getUnloadedLatencyPoints:()=>[0],getDownLoadedLatencyPoints:()=>[8]
  };
  const read=readResults(results);
  assert.equal(read.metrics.downloadBps,1234);assert.equal(read.metrics.uploadBps,null);
  assert.equal(read.metrics.latencyMs,0);assert.equal(read.metrics.jitterMs,null);
  assert.equal(read.completedBytes,1024);
  assert.ok(!JSON.stringify(read).includes('private-data'));
});

test('cancel before a lazy import prevents the engine from starting',async()=>{
  let resolve,created=0;const states=[];
  const controller=createSpeedTestController({onState:state=>states.push(state),loadEngine:()=>new Promise(r=>{resolve=r;})});
  const pending=controller.start('light');controller.cancel();
  resolve(class{constructor(){created++;}});await pending;
  assert.equal(created,0);assert.equal(states.at(-1).status,'incomplete');
  controller.dispose();
});

test('cancel pauses in-flight SDK work and late callbacks cannot replace a new result',async()=>{
  const engines=[],states=[];
  class Engine {
    results=undefined;
    constructor(config){this.config=config;engines.push(this);}
    play(){this.started=true;}
    pause(){this.paused=true;}
  }
  const controller=createSpeedTestController({onState:state=>states.push(state),loadEngine:async()=>Engine});
  await controller.start('light');const stale=engines[0].onFinish;
  controller.cancel();assert.ok(engines[0].paused);
  await controller.start('standard');stale();
  assert.equal(states.at(-1).status,'running');
  engines[1].onFinish();assert.equal(states.at(-1).status,'complete');
  controller.dispose();
});

test('overall timeout preserves partial statistics and stops the engine',async()=>{
  const states=[];let engine;
  class Engine {constructor(){engine=this;}play(){}pause(){this.paused=true;}}
  const controller=createSpeedTestController({onState:state=>states.push(state),loadEngine:async()=>Engine,timeoutMs:15});
  await controller.start('light');await new Promise(r=>setTimeout(r,40));
  assert.equal(states.at(-1).status,'incomplete');assert.equal(states.at(-1).reason,'timeout');
  assert.ok(engine.paused);controller.dispose();
});
