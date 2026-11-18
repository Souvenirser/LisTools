import {normalizeConfig} from './core.js';
import {salaryKey,salaryEvent} from './key.js';
export {salaryKey};
export function createSalaryStore(storage,locks){
 let memory=null,loaded=false,observed;const listeners=new Set();
 const notify=external=>{for(const callback of listeners)callback(memory,external);};
 function readLatest(){
  try{
   const raw=storage?.getItem(salaryKey);
   if(!loaded||raw!==observed){
    observed=raw;
    try{memory=raw?normalizeConfig(JSON.parse(raw)):null;}catch{memory=null;}
   }
  }catch{/* Keep this page's session if storage is unavailable. */}
  loaded=true;return memory;
 }
 function read(){return loaded?memory:readLatest();}
 // Without a shared lock, changes stay in this page's session.
 async function mutate(operation){
  if(!storage||!locks?.request)return operation(false);
  let acquired=false;
  try{
   return await locks.request(salaryKey,()=>{acquired=true;return operation(true);});
  }catch(error){
   if(acquired)throw error;
   return operation(false);
  }
 }
 function save(raw,persist){
  const config=normalizeConfig(raw);read();memory=config;let saved=false;
  try{if(persist){const value=JSON.stringify(config);storage.setItem(salaryKey,value);observed=value;saved=true;}}catch{/* Keep the explicitly enabled current-page session. */}
  notify(false);return {config,saved};
 }
 return {read,
  save(raw){return mutate(persist=>save(raw,persist));},
  saveSchedule(schedule){return mutate(persist=>{
   const latest=readLatest();return save({...schedule,showBar:latest?.showBar??false,masked:latest?.masked??schedule.masked},persist);
  });},
  updateDisplay(change){return mutate(persist=>{
   const latest=readLatest();if(latest)return save({...latest,...change(latest)},persist);
  });},
  clear(){return mutate(persist=>{
   readLatest();memory=null;let cleared=false;
   try{if(persist){storage.removeItem(salaryKey);observed=null;cleared=true;}}catch{/* Report failed removal instead of claiming persistent data was cleared. */}
   notify(false);return cleared;
  });},
  refresh(){readLatest();notify(true);},subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);}
 };
}
let storage,locks;try{storage=globalThis.localStorage;locks=globalThis.navigator?.locks;}catch{/* Current-page session only. */}
export const salaryStore=createSalaryStore(storage,locks);
globalThis.addEventListener?.('storage',event=>{if(event.key===salaryKey||event.key===null)salaryStore.refresh();});

salaryStore.subscribe(()=>globalThis.dispatchEvent?.(new Event(salaryEvent)));
