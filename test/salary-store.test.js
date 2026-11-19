import test from 'node:test';
import assert from 'node:assert/strict';
import {createSalaryStore as storeWithLocks,salaryKey,scheduleKey} from '../src/tools/salary/store.js';
import {defaultConfig,normalizeConfig,snapshot} from '../src/tools/salary/core.js';
const createSalaryStore=(storage,locks={request:async (_name,operation)=>operation()})=>storeWithLocks(storage,locks);
const now=Date.parse('2026-11-02T10:00:00+08:00');
const config=()=>normalizeConfig({...defaultConfig(now,'Asia/Shanghai'),salary:'16800'});
const storage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('salary draft is not persisted and explicit save stores settings without computed earnings',async()=>{
 const s=storage(),store=createSalaryStore(s);assert.equal(store.read(),null);assert.equal(s.map.size,0);assert.equal((await store.save(config())).saved,true);const raw=JSON.parse(s.getItem(salaryKey));assert.equal(raw.salary,'16800');assert.equal(raw.earned,undefined);assert.equal(raw.history,undefined);assert.equal(raw.version,1);
});
test('saved config restores after reopening without double counting and changes reach subscribers',async()=>{
 const s=storage(),a=createSalaryStore(s),b=createSalaryStore(s);let changes=0;b.subscribe(()=>changes++);await a.save(config());b.refresh();assert.equal(changes,1);assert.equal(snapshot(b.read(),now).earned,'100.0000');assert.equal(snapshot(createSalaryStore(s).read(),now).earned,'100.0000');
});
test('quota and blocked storage retain an honest current-page session',async()=>{
 const s=storage();s.setItem(salaryKey,JSON.stringify(config()));s.setItem=()=>{throw Error('quota');};const store=createSalaryStore(s),next={...config(),salary:'33600'};assert.equal((await store.save(next)).saved,false);assert.equal(store.read().salary,'33600');
 const blocked=createSalaryStore({getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}});assert.equal(blocked.read(),null);assert.equal((await blocked.save(config())).saved,false);assert.equal(blocked.read().salary,'16800');assert.equal(await blocked.clear(),false);assert.equal(blocked.read(),null);
});
test('clearing only removes salary settings and does not erase other tools',async()=>{
 const s=storage();s.map.set('other-tool','synthetic data');const store=createSalaryStore(s);await store.save(config());assert.equal(await store.clear(),true);assert.equal(store.read(),null);assert.equal(s.getItem('other-tool'),'synthetic data');
});
test('corrupt and future-version configurations are not enabled or rewritten',async()=>{
 for(const value of ['bad','{}',JSON.stringify({...config(),version:2})]){const s=storage();s.setItem(salaryKey,value);assert.equal(createSalaryStore(s).read(),null);assert.equal(s.getItem(salaryKey),value);}
});

test('unavailable locks keep changes in memory without persisting unlocked writes',async()=>{
 const s=storage(),store=createSalaryStore(s,{request:async()=>{throw Error('denied');}});
 assert.equal((await store.saveSchedule({...config(),masked:true})).saved,false);
 assert.equal(store.read().masked,true);assert.equal(s.getItem(salaryKey),null);
 assert.equal((await store.updateDisplay(()=>({showBar:true}))).saved,false);
 assert.equal(await store.clear(),false);assert.equal(store.read(),null);
});

test('a mask that could not be saved survives unrelated changes from another page',async()=>{
 const shared=storage(),other=createSalaryStore(shared);
 await other.save(config());
 const local=createSalaryStore({...shared,setItem(){throw new DOMException('test quota','QuotaExceededError');}});
 const localMask=await local.updateDisplay(()=>({masked:true}));
 assert.equal(localMask.saved,false);
 await other.updateDisplay(()=>({showBar:true}));
 local.refresh();
 assert.equal(local.read().masked,true);
 assert.equal(local.read().showBar,true);
 await local.updateDisplay(()=>({masked:false}));
 assert.equal(local.read().masked,false);
});

test('a queued schedule save must observe the same schedule it started with',async()=>{
 const shared=storage(),other=createSalaryStore(shared);
 await other.save(config());
 let finish;
 const local=createSalaryStore(shared,{request:(_name,operation)=>new Promise(resolve=>{finish=()=>resolve(operation());})});
 const pending=local.saveSchedule({...config(),salary:'20000'});
 await other.clear();
 finish();
 assert.deepEqual(await pending,{conflict:true});
 assert.equal(shared.getItem(salaryKey),null);
});
test('an unreadable latest record cannot be overwritten by stale local settings',async()=>{
 const shared=storage(),other=createSalaryStore(shared);
 await other.save(config());
 let blocked=false;
 const local=createSalaryStore({...shared,getItem(key){
  if(blocked)throw new DOMException('test storage','SecurityError');
  return shared.getItem(key);
 }});
 local.read();
 await other.save({...config(),salary:'22000'});
 blocked=true;
 assert.equal((await local.saveSchedule({...config(),salary:'20000'})).saved,false);
 assert.equal((await local.updateDisplay(()=>({showBar:true}))).saved,false);
 assert.equal(JSON.parse(shared.getItem(salaryKey)).salary,'22000');
 assert.equal(JSON.parse(shared.getItem(salaryKey)).showBar,false);
});
test('clear leaves a different schedule saved after the confirmation was opened',async()=>{
 const shared=storage(),local=createSalaryStore(shared),other=createSalaryStore(shared);
 await local.save(config());
 const confirmed=scheduleKey(local.read());
 await other.save({...config(),salary:'22000'});
 assert.equal(await local.clear(confirmed),null);
 assert.equal(JSON.parse(shared.getItem(salaryKey)).salary,'22000');
});
