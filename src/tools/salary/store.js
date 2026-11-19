import {normalizeConfig} from './core.js';
import {salaryKey,salaryEvent} from './key.js';
export {salaryKey};
export function scheduleKey(config){
 if(!config)return null;
 const {masked,showBar,...schedule}=config;
 return JSON.stringify(schedule);
}
export function createSalaryStore(storage,locks){
 let memory=null,loaded=false,observed,localMask=false;const listeners=new Set();
 const notify=external=>{for(const callback of listeners)callback(memory,external);};
 const retainMask=config=>localMask&&config&&!config.masked?{...config,masked:true}:config;
 function readLatest(){
  let readable=false;
  try{
   const raw=storage.getItem(salaryKey);
   readable=true;
   if(!loaded||raw!==observed){
    observed=raw;
    try{memory=raw?retainMask(normalizeConfig(JSON.parse(raw))):null;}catch{memory=null;}
   }
  }catch{/* Keep this page's session if storage is unavailable. */}
  loaded=true;return {config:memory,readable};
 }
 function read(){return loaded?memory:readLatest().config;}
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
 function save(raw,persist,maskChoice){
  const config=normalizeConfig(maskChoice===undefined?retainMask(raw):raw);read();let saved=false;
  try{if(persist){const value=JSON.stringify(config);storage.setItem(salaryKey,value);observed=value;saved=true;}}catch{/* Keep the explicitly enabled current-page session. */}
  if(maskChoice!==undefined)localMask=maskChoice&&!saved;
  memory=config;
  notify(false);return {config,saved};
 }
 return {read,
  save(raw){return mutate(persist=>save(raw,persist&&readLatest().readable));},
  saveSchedule(schedule,expected=scheduleKey(read())){return mutate(persist=>{
   const {config:latest,readable}=readLatest();
   if(scheduleKey(latest)!==expected){notify(true);return {conflict:true};}
   return save({...schedule,showBar:latest?.showBar??false,masked:latest?.masked??schedule.masked},persist&&readable);
  });},
  updateDisplay(change){return mutate(persist=>{
   const {config:latest,readable}=readLatest();if(!latest)return;
   const display=change(latest);
   return save({...latest,...display},persist&&readable,display.masked);
  });},
  clear(expected=scheduleKey(read())){return mutate(persist=>{
   const {config,readable}=readLatest();
   if(scheduleKey(config)!==expected){notify(true);return null;}
   memory=null;let cleared=false;
   try{if(persist&&readable){storage.removeItem(salaryKey);observed=null;cleared=true;}}catch{/* Report failed removal instead of claiming persistent data was cleared. */}
   notify(false);return cleared;
  });},
  refresh(){readLatest();notify(true);},subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);}
 };
}
let storage,locks;try{storage=globalThis.localStorage;locks=globalThis.navigator?.locks;}catch{/* Current-page session only. */}
export const salaryStore=createSalaryStore(storage,locks);
globalThis.addEventListener?.('storage',event=>{if(event.key===salaryKey||event.key===null)salaryStore.refresh();});

salaryStore.subscribe(()=>globalThis.dispatchEvent?.(new Event(salaryEvent)));
