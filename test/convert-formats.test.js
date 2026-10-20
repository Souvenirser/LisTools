import test from 'node:test';
import assert from 'node:assert/strict';
import { executeConversion as convert } from '../src/tools/convert/runtime.js';
async function output(id, source, options={}) {
  const r=await convert(id,source,options); assert.equal(r.status,'ready',r.message); return r.blob.text();
}

test('YAML 与 JSON 大整数、长小数、科学计数及负零往返不经过浮点数', async () => {
  const json='{"n":900719925474099312345,"d":0.123456789012345678901,"e":1e999,"z":-0,"v":"001","on":"yes"}';
  const yaml=await output('json-yaml',json);
  const back=await output('json-yaml',yaml,{direction:'decode'});
  for(const token of ['900719925474099312345','0.123456789012345678901','1e999','-0','"001"','"yes"']) assert.ok(back.includes(token),`${token}: ${back}`);
  const special=await output('json-yaml','{"__proto__":1,"constructor":2}');
  assert.deepEqual(JSON.parse(await output('json-yaml',special,{direction:'decode'})),JSON.parse('{"__proto__":1,"constructor":2}'));
});

test('YAML 拒绝重复键、非字符串键、特殊类型、循环、过量别名及多文档', async () => {
  for (const source of ['a: 1\na: 2','1: x','a: .inf','a: !!timestamp 2024-01-01','a: &a [*a]','a: 1\n---\nb: 2']) {
    assert.equal((await convert('json-yaml',source,{direction:'decode'})).status,'error',source);
  }
  const valid=await output('json-yaml','a: &a {k: 1}\nb: *a',{direction:'decode'});
  assert.deepEqual(JSON.parse(valid),{a:{k:1},b:{k:1}});
  const bomb='a: &a [1,2,3,4,5,6,7,8,9,0]\nb: &b ['+Array(20).fill('*a').join(',')+']\nc: ['+Array(20).fill('*b').join(',')+']';
  assert.equal((await convert('json-yaml',bomb,{direction:'decode'})).status,'error');
});

test('XML 保留属性、命名空间、混合内容、实体、CDATA、注释和文本数字', async () => {
  const source='<r xmlns:x="urn:demo" id="001">before<x:a n="2">9007199254740993 &amp; 中</x:a>after<![CDATA[<x>]]><!--note--></r>';
  const json=await output('xml-json',source);
  const back=await output('xml-json',json,{direction:'decode'});
  assert.equal(back,source);
  assert.ok(json.includes('9007199254740993'));
  assert.equal((await convert('xml-json','<!DOCTYPE r [<!ENTITY x "secret">]><r>&x;</r>')).status,'error');
  assert.equal((await convert('xml-json','{"a":1}',{direction:'decode'})).status,'error');
  assert.equal((await convert('xml-json','<a><b></a>')).status,'error');
});
test('XML 数字字符引用解码为字符，属性和补充码点不变成字面转义', async () => {
  const json=await output('xml-json','<a n="&#65;&#x41;">&#65;&#x41;&#x1F642;&amp;#0;</a>');
  assert.deepEqual(JSON.parse(json),[{a:[{'#text':'AA🙂&#0;'}],':@':{'@_n':'AA'}}]);
  const xml=await output('xml-json',json,{direction:'decode'});
  assert.equal(await output('xml-json',xml),json);
});
test('XML 拒绝非法字符引用、原始字符和多个文档根节点', async () => {
  for(const source of ['<a>&#0;</a>','<a>&#xD800;</a>','<a>&#x110000;</a>','<a>&#xFFFF;</a>','<a>&#1;</a>','<a>\0</a>','<a/><b/>']) {
    assert.equal((await convert('xml-json',source)).status,'error',source);
  }
});

test('CSV/TSV 字段保持字符串，严格列数与表头；引用换行完整保留', async () => {
  const source='id,note\r\n001,"中,文\nnext"\r\n9007199254740993,"a""b"';
  assert.deepEqual(JSON.parse(await output('csv-json',source)),[{id:'001',note:'中,文\nnext'},{id:'9007199254740993',note:'a"b'}]);
  for(const bad of ['a,a\n1,2','a,b\n1','a,b\n1,2,3','a,b\n1,"bad']) assert.equal((await convert('csv-json',bad)).status,'error',bad);
  const rows=await output('tsv-json','001\tx\n2\ty',{header:false});
  assert.deepEqual(JSON.parse(rows),[['001','x'],['2','y']]);
  const csv=await output('csv-json','[{"n":9007199254740993,"s":"=1+1"}]',{direction:'decode'});
  assert.ok(csv.includes('9007199254740993')); assert.ok(csv.includes('=1+1'));
});

test('CSV JSON 单元格模式显式保留 null、嵌套结构和大数，默认拒绝缺失值', async () => {
  const json='[{"n":9007199254740993,"x":null,"v":{"a":1}},{"n":2,"x":"","v":[true]}]';
  assert.equal((await convert('csv-json',json,{direction:'decode'})).status,'error');
  const csv=await output('csv-json',json,{direction:'decode',cells:'json'});
  const back=await output('csv-json',csv,{cells:'json'});
  assert.ok(back.includes('9007199254740993'));
  assert.deepEqual(JSON.parse(back),JSON.parse(json));
  assert.equal((await convert('csv-json','[{"a":1},{"b":2}]',{direction:'decode'})).status,'error');
});
test('CSV 不接受无法保留行形状的非空零列表格', async () => {
  for(const [input,header] of [['[[]]',false],['[{},{}]',true]]) assert.equal((await convert('csv-json',input,{direction:'decode',header})).status,'error');
});
test('CSV 将空单元格明确加引号，单列空字符串行不会被导出为空文件', async () => {
  const json='[[""],[""]]';
  const csv=await output('csv-json',json,{direction:'decode',header:false});
  assert.equal(csv,'""\r\n""');
  assert.deepEqual(JSON.parse(await output('csv-json',csv,{header:false})),JSON.parse(json));
});

test('JSON Lines 精度、逐行错误位置与重复键不丢失', async () => {
  const input='[{"n":9007199254740993},null,"x"]';
  assert.equal(await output('jsonl',input,{direction:'decode'}),'{"n":9007199254740993}\nnull\n"x"');
  const r=await convert('jsonl','{"a":1}\n{"a":}');
  assert.equal(r.status,'error'); assert.equal(r.line,2);
  assert.equal((await convert('jsonl','{"a":1,"a":2}')).status,'error');
});

test('Query String 保留重复参数、空值和特殊键，反向映射严格使用字符串数组', async () => {
  const q='a=1&a=2&plus=%2B&space=+&empty=&__proto__=ok';
  const json=await output('query-json',q);
  assert.deepEqual(JSON.parse(json),JSON.parse('{"a":["1","2"],"plus":["+"],"space":[" "],"empty":[""],"__proto__":["ok"]}'));
  assert.equal(await output('query-json',json,{direction:'decode'}),q);
  assert.equal((await convert('query-json','{"a":1}',{direction:'decode'})).status,'error');
  assert.equal((await convert('query-json','a=%GG')).status,'error');
});
test('Query 反向拒绝 JSON 转义中的孤立代理项，不由 URLSearchParams 替换为 U+FFFD', async () => {
  for(const input of ['{"a":["\\ud800"]}','{"\\ud800":["x"]}']) assert.equal((await convert('query-json',input,{direction:'decode'})).status,'error');
  assert.equal(await output('query-json','{"emoji":["\\ud83d\\ude42"]}',{direction:'decode'}),'emoji=%F0%9F%99%82');
});

test('严格 JSON 适配不吞相同重复键或误认特殊字段为数值标记', async () => {
  assert.equal((await convert('jsonl','{"a":1,"a":1}')).status,'error');
  const input='[{"__proto__":{"x":1},"constructor":"ok","isLosslessNumber":true,"value":"not-number"}]';
  const lines=await output('jsonl',input,{direction:'decode'});
  assert.deepEqual(JSON.parse(lines),JSON.parse(input)[0]);
});
