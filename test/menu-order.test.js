import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMenuOrder,readMenuOrder,saveMenuOrder,readMenuExpanded,saveMenuExpanded} from '../src/tools/shared/menu-order.js';

test('menu preferences preserve valid order and append missing current tools',()=>{
 const order=normalizeMenuOrder({version:1,groups:['network','daily','network','removed'],items:{daily:['timer','calculator','timer','json','removed']}});
 assert.deepEqual(order.groups,['network','daily','files','developer']);
 assert.deepEqual(order.items.daily,['timer','calculator','dates','units','money','draw']);
 assert.deepEqual(order.items.network,['speedtest','password']);
 assert.equal(Object.values(order.items).flat().length,19);
});
test('invalid or incompatible preferences fall back without losing tools',()=>{
 for(const raw of [null,[],{version:9,groups:['network']},{version:1,groups:'bad',items:{daily:'bad'}}]){
  const order=normalizeMenuOrder(raw);assert.deepEqual(order.groups,['daily','files','developer','network']);assert.equal(new Set(Object.values(order.items).flat()).size,19);
 }
});
test('saving stores IDs only and denied storage keeps a usable in-memory preference',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const order=normalizeMenuOrder({version:1,groups:['network']});
 assert.equal(saveMenuOrder({...order,secret:'must not save'},storage),true);assert.deepEqual(readMenuOrder(storage),order);
 assert.equal([...data.values()][0].includes('secret'),false);
 const denied={getItem(){return null;},setItem(){throw Error('denied');}};
 assert.equal(saveMenuOrder(order,denied),false);assert.deepEqual(readMenuOrder(denied),order);
});

test('category expansion defaults to collapsed and only accepts existing group IDs',()=>{
 for(const raw of [null,'bad','{}','["removed"]'])assert.deepEqual(readMenuExpanded({getItem:()=>raw}),[]);
 assert.deepEqual(readMenuExpanded({getItem:()=>'["network","files","network","removed"]'}),['files','network']);
});

test('category expansion stores stable IDs independently of tool order and reads later changes',()=>{
 const data=new Map([['listools-menu-order-v1','keep order']]),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.equal(saveMenuExpanded(['network','files','network','removed'],storage),true);
 assert.deepEqual(readMenuExpanded(storage),['files','network']);assert.equal(data.get('listools-menu-order-v1'),'keep order');
 data.set('listools-menu-expanded-v1','["developer"]');assert.deepEqual(readMenuExpanded(storage),['developer']);
 assert.equal(saveMenuExpanded([],storage),true);assert.deepEqual(readMenuExpanded(storage),[]);
});

test('denied category storage retains the current page expansion preference',()=>{
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(saveMenuExpanded(['developer'],denied),false);assert.deepEqual(readMenuExpanded(denied),['developer']);
});
