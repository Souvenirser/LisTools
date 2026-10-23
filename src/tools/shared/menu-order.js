import {pages,toolGroups} from './navigation.js';

export const menuOrderKey='listools-menu-order-v1';
let memory,unsaved=false;
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
