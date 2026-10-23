import {pages,toolGroups} from './navigation.js';

export const menuOrderKey='listools-menu-order-v1';
export const menuExpandedKey='listools-menu-expanded-v1';
let memory,unsaved=false;
let expandedMemory=[],expandedUnsaved=false;
const expandedGroups=raw=>toolGroups.filter(group=>Array.isArray(raw)&&raw.includes(group.id)).map(group=>group.id);
const ordered=(ids,valid)=>[...new Set([...(Array.isArray(ids)?ids:[]).filter(id=>valid.includes(id)),...valid])];
export function normalizeMenuOrder(raw){
 if(raw?.version!==1)raw=undefined;
 return {version:1,groups:ordered(raw?.groups,toolGroups.map(group=>group.id)),items:Object.fromEntries(toolGroups.map(({id})=>[id,ordered(raw?.items?.[id],pages.filter(page=>page.group===id).map(page=>page.id))]))};
}
export function readMenuOrder(storage){
 if(unsaved)return memory;
 try{return normalizeMenuOrder(JSON.parse((storage??localStorage).getItem(menuOrderKey)));}
 catch{return memory??normalizeMenuOrder();}
}
export function saveMenuOrder(order,storage){
 memory=normalizeMenuOrder(order);
 try{(storage??localStorage).setItem(menuOrderKey,JSON.stringify(memory));unsaved=false;return true;}
 catch{unsaved=true;return false;}
}
export function readMenuExpanded(storage){
 if(expandedUnsaved)return expandedMemory;
 try{return expandedGroups(JSON.parse((storage??localStorage).getItem(menuExpandedKey)));}
 catch{return expandedMemory;}
}
export function saveMenuExpanded(groups,storage){
 expandedMemory=expandedGroups(groups);
 try{(storage??localStorage).setItem(menuExpandedKey,JSON.stringify(expandedMemory));expandedUnsaved=false;return true;}
 catch{expandedUnsaved=true;return false;}
}
