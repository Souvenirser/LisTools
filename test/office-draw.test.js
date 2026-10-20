import test from 'node:test';
import assert from 'node:assert/strict';
import { entries, randomInteger, shuffle, sample, group, integers, csv } from '../src/tools/draw/core.js';
test('keeps duplicate entries and removes only blank rows',()=>assert.deepEqual(entries('A\n A\n\nB'),['A','A','B']));
test('rejection sampling discards biased tail and includes endpoints',()=>{
 const values=[4294967295,9,0]; assert.equal(randomInteger(10,()=>values.shift()),9);assert.equal(randomInteger(10,()=>values.shift()),0);
});
test('shuffle and sample retain distinct duplicate entries without replacement',()=>{
 assert.deepEqual(shuffle(['A','A','B'],()=>0),['A','B','A']);
 assert.equal(sample(['A','A','B'],3,()=>0).length,3);
 assert.throws(()=>sample(['A'],2),{code:'draw.invalidCount'});
});
test('group count and member count distribute every entry once',()=>{
 assert.deepEqual(group(['1','2','3','4','5'],2,'groups',()=>0).map(a=>a.length),[3,2]);
 assert.deepEqual(group(['1','2','3','4','5'],2,'members',()=>0).map(a=>a.length),[2,2,1]);
});
test('inclusive unique integer draw handles negative endpoints and rejects overdraw',()=>{
 assert.deepEqual(integers(-2,0,3,false,()=>0),[-2,-1,0]);
 assert.deepEqual(integers(4,4,2,true,()=>0),[4,4]);
 assert.throws(()=>integers(1,2,3,false),{code:'draw.invalidCount'});
 assert.throws(()=>integers(2,1,1,true),{code:'draw.invalidRange'});
});
test('CSV exports quotes and formula-like names safely',()=>assert.equal(csv([['=SUM(A1)','a,b']]),'"\'=SUM(A1)","a,b"'));
