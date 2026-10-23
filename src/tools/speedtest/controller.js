import { speedConfig, plannedBytes, readResults } from './core.js';
import { createSpeedRequestGuard } from './requests.js';

export function createSpeedTestController({onState,loadEngine=async()=>(await import('@cloudflare/speedtest')).default,timeoutMs=120000}) {
  let generation=0,engine,deadline,ticker,started,profile='light',phase='latency',running=false,guard,nativeFetch;
  const snapshot=(status,extra={})=>({status,profile,phase,startedAt:started?new Date(started).toISOString():null,elapsedMs:started?Date.now()-started:0,plannedBytes:plannedBytes(profile),...readResults(engine?.results),...extra});
  function stop() {
    generation++;running=false;clearTimeout(deadline);clearInterval(ticker);
    if(engine) {
      engine.onFinish=()=>{};engine.onError=()=>{};engine.onResultsChange=()=>{};engine.onPhaseChange=()=>{};
      engine.pause();engine=undefined;
    }
    if(guard) {
      guard.dispose();if(globalThis.fetch===guard.fetch)globalThis.fetch=nativeFetch;
      guard=undefined;nativeFetch=undefined;
    }
  }
  function finish(reason,message) {
    if(!running)return;
    const state=snapshot(reason==='complete'?'complete':'incomplete',{reason,...message?{message}:{}});
    stop();onState(state);
  }
  async function start(nextProfile='light') {
    speedConfig(nextProfile);stop();profile=nextProfile;started=Date.now();phase='latency';running=true;
    nativeFetch=globalThis.fetch;guard=createSpeedRequestGuard(nativeFetch.bind(globalThis));globalThis.fetch=guard.fetch;
    const id=generation;
    onState(snapshot('running'));
    deadline=setTimeout(()=>finish('timeout'),timeoutMs);
    ticker=setInterval(()=>{if(id===generation)onState(snapshot('running'));},1000);
    try {
      const Engine=await loadEngine();
      if(id!==generation)return;
      engine=new Engine(speedConfig(profile));
      engine.onResultsChange=()=>{if(id===generation)onState(snapshot('running'));};
      engine.onPhaseChange=event=>{if(id===generation){phase=event.measurement.type;onState(snapshot('running'));}};
      engine.onFinish=()=>{if(id===generation)finish('complete');};
      engine.onError=()=>{if(id===generation)finish('network','公共测速节点不可用 / The public speed test node is unavailable.');};
      engine.play();
    } catch {if(id===generation)finish('error','无法启动测速 / Could not start the speed test.');}
  }
  return {start,cancel:()=>finish('cancelled'),clear:()=>{stop();onState({status:'idle'});},dispose:()=>{if(running)finish('cancelled');else stop();}};
}
