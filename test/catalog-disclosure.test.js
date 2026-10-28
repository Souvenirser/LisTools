import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogDisclosure,catalogDisclosureKey} from '../src/tools/convert/catalog-disclosure.js';
test('catalog defaults open and persists only known category booleans',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 let state=createCatalogDisclosure(['base','text'],storage);assert.equal(state.isOpen('base'),true);state.setOpen('base',false);
 state=createCatalogDisclosure(['base','text','new'],storage);assert.equal(state.isOpen('base'),false);assert.equal(state.isOpen('new'),true);
 state.setOpen('removed',false);assert.deepEqual(JSON.parse(values.get(catalogDisclosureKey)),{version:1,open:{base:false}});
 values.set(catalogDisclosureKey,JSON.stringify({version:1,open:{base:'no',text:false,removed:true}}));state=createCatalogDisclosure(['base','text'],storage);assert.equal(state.isOpen('base'),true);assert.equal(state.isOpen('text'),false);
});
test('unavailable or corrupt storage still permits local disclosure changes',()=>{
 for(const storage of[{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},{getItem:()=>'{',setItem(){}}]){
  const state=createCatalogDisclosure(['base'],storage);state.setOpen('base',false);assert.equal(state.isOpen('base'),false);state.setOpen('base',true);assert.equal(state.isOpen('base'),true);
 }
});
