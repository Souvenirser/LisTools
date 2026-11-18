import test from 'node:test';
import assert from 'node:assert/strict';
import {createSalaryStore as storeWithLocks,salaryKey} from '../src/tools/salary/store.js';
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
