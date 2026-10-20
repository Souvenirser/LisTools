import test from 'node:test';
import assert from 'node:assert/strict';
import { tools, categories, findTools, defaults } from '../src/tools/convert/registry.js';
import { executeConversion } from '../src/tools/convert/runtime.js';
test('静态目录覆盖全部 37 种工具，中文英文别名可查且每个选项有合法默认值', () => {
  assert.equal(tools.length,37); assert.equal(new Set(tools.map(t=>t.id)).size,37);
  assert.equal(categories.length,8);
  for(const tool of tools) {
    assert.ok(categories.some(c=>c.id===tool.category));
    for(const option of tool.options) if(option.values) assert.ok(option.values.some(v=>v[0]===defaults(tool)[option.key]),tool.id+option.key);
  }
  for(const term of ['decode','base64url','urlencode','编码','gzip']) assert.ok(findTools(term).length,term);
  assert.ok(findTools('base64url').some(t=>t.id==='base64url'));
});
test('每种工具的默认配置均连接到实际适配器', async () => {
  const samples={'json-yaml':'{}','xml-json':'<root/>','csv-json':'a\n1','tsv-json':'a\n1',jsonl:'{}','query-json':'a=1',jwt:'eyJhbGciOiJub25lIn0.e30.',radix:'123','bytes-unit':'1','duration-unit':'1',color:'#fff'};
  for(const tool of tools) {
    const result=await executeConversion(tool.id,samples[tool.id] ?? 'hello',defaults(tool));
    assert.equal(result.status,'ready',tool.id+': '+result.message);
  }
});

test('MD5 has a dedicated searchable entry while general hashes retain SHA-256',()=>{assert.ok(findTools('MD5 加密').some(tool=>tool.id==='md5'));assert.equal(defaults(tools.find(tool=>tool.id==='hash')).algorithm,'sha256');});
