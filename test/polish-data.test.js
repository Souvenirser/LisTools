import test from 'node:test';
import assert from 'node:assert/strict';
import { compareText, compareJson } from '../src/tools/json-diff/core.js';
import { inlineDiff } from '../src/tools/json-diff/text-diff.js';
import { executeConversion as convert } from '../src/tools/convert/runtime.js';

test('polish-data marks line budget, long inline and exhausted inline fallbacks',()=>{
  assert.equal(compareText('a\n'.repeat(2200),'b\n'.repeat(2200)).coarse,true);
  assert.equal(compareText('x'.repeat(17000)+'A','x'.repeat(17000)+'B').coarse,true);
  assert.equal(inlineDiff('old','new',0).coarse,true);
  assert.equal(compareJson(JSON.stringify({x:'a'.repeat(17000)}),JSON.stringify({x:'b'.repeat(17000)})).coarse,true);
});
test('polish-data captures CodeMirror scan fallback and preserves patches',()=>{
  const result=compareText('a1 '.repeat(200),'b1 '.repeat(200));
  assert.equal(result.coarse,true);
  let value='',at=0;for(const change of result.textChanges){value+=result.leftText.slice(at,change.fromA)+result.rightText.slice(change.fromB,change.toB);at=change.toA;}
  assert.equal(value+result.leftText.slice(at),result.rightText);
});
test('polish-data structured CSV errors preserve legacy messages and actionable params',async()=>{
  for(const [input,options,reasonCode,params] of [
    ['a,b\n1',{},'CsvColumns',{row:2,actual:1,expected:2}],
    ['a,a\n1,2',{},'CsvHeaders',undefined],
    ['a\nnot-json',{cells:'json'},'CsvJsonCell',{row:2,column:1}],
    ['[[1]]',{direction:'decode'},'CsvArrayHeader',undefined],
    ['[{"a":null}]',{direction:'decode'},'CsvNestedValue',undefined],
    ['[{"a":1},{"b":2}]',{direction:'decode'},'CsvRowShape',undefined]
  ]){const result=await convert('csv-json',input,options);assert.equal(result.status,'error');assert.equal(result.reasonCode,reasonCode);assert.deepEqual(result.params,params);assert.ok(result.message);}
});
test('polish-data ordered XML and query arrays expose stable reasons',async()=>{
  for(const [id,input,reason] of [['xml-json','{"a":1}','XmlOrdered'],['xml-json','[{"a":12}]','XmlOrdered'],['query-json','{"a":1}','QueryArrays']]) assert.equal((await convert(id,input,{direction:'decode'})).reasonCode,reason);
});
test('polish-data notices preserve full bytes, charset and legacy notice',async()=>{
  const result=await convert('hex','ff00',{direction:'decode',charset:'utf-8'});
  assert.equal(result.previewKind,'hex');assert.deepEqual(result.notices,[{code:'ByteHex',params:{charset:'utf-8'}}]);
  assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())],[255,0]);assert.ok(result.notice);
  assert.deepEqual((await convert('csv-json','a\n001')).notices,[{code:'CsvStrings'}]);
  assert.deepEqual((await convert('xml-json','<r/>')).notices,[{code:'StructureOnly'}]);
});
