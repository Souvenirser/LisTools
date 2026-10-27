import {pages} from './navigation.js';
export const preferencesKey='listools-preferences-v1';
const ids=new Set(pages.map(page=>page.id));
const unique=value=>[...new Set(Array.isArray(value)?value.filter(id=>ids.has(id)):[])];
const categories=new Set(['length','area','volume','mass','weight','temperature','speed','pressure','energy','power','angle','bytes','duration']);
let memory,unsaved=false;
export function normalizePreferences(value={}) {
 const source=value&&typeof value==='object'?value:{},input=source.options||{},options={};
 if(Number.isInteger(input.qrSize)&&input.qrSize>=128&&input.qrSize<=2048)options.qrSize=input.qrSize;
 if(['L','M','Q','H'].includes(input.qrLevel))options.qrLevel=input.qrLevel;
 if(typeof input.timeZone==='string'&&input.timeZone.length<=100){try{new Intl.DateTimeFormat('en',{timeZone:input.timeZone});options.timeZone=input.timeZone;}catch{}}
 if(categories.has(input.unitCategory))options.unitCategory=input.unitCategory;
 return {version:1,theme:['system','light','dark'].includes(source.theme)?source.theme:'system',favorites:unique(source.favorites),recent:unique(source.recent).slice(0,5),options};
}
export function readPreferences(storage) {
 if(unsaved)return normalizePreferences(memory);
 let raw;try{raw=(storage||globalThis.localStorage)?.getItem(preferencesKey);}catch{return normalizePreferences(memory);}
 try{return normalizePreferences(JSON.parse(raw||'null'));}catch{return normalizePreferences();}
}
export function savePreferences(value,storage) {
 memory=normalizePreferences(value);let saved=true;
 try{(storage||globalThis.localStorage).setItem(preferencesKey,JSON.stringify(memory));}catch{saved=false;}
 unsaved=!saved;
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('listools:preferences',{detail:memory}));
 return saved;
}
export function toggleFavorite(id,storage) {
 const value=readPreferences(storage);if(!ids.has(id))return value;
 value.favorites=value.favorites.includes(id)?value.favorites.filter(item=>item!==id):[...value.favorites,id];savePreferences(value,storage);return value;
}
export function recordRecent(id,storage) {
 const value=readPreferences(storage);if(!ids.has(id))return value;
 value.recent=[id,...value.recent.filter(item=>item!==id)].slice(0,5);savePreferences(value,storage);return value;
}
