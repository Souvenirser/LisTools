import test from 'node:test';
import assert from 'node:assert/strict';
import { transformJson } from '../src/tools/json/core.js';

test('美化和压缩保留数字字面量及 Unicode', () => {
  const source = '{"id":900719925474099312345,"decimal":1.234567890123456789,"exp":1e400,"name":"你好","zero":-0}';
  const formatted = transformJson(source);
  assert.equal(formatted.status, 'ready');
  assert.match(formatted.text, /900719925474099312345/);
  assert.match(formatted.text, /1\.234567890123456789/);
  assert.match(formatted.text, /1e400/);
  assert.match(formatted.text, /"zero": -0/);
  assert.equal(transformJson(formatted.text, { action: 'compact' }).text, source);
});

test('合法根值、转义和缩进', () => {
  for (const source of ['null', 'true', '12345678901234567890', '"你好\\n世界"', '[]', '{}']) {
    assert.equal(transformJson(source).text, source);
  }
  assert.equal(transformJson('{"a":[1]}', { indent: 4 }).text, '{\n    "a": [\n        1\n    ]\n}');
});

test('统计结构节点，为大文件批量展开提供判断依据', () => {
  assert.equal(transformJson('{"a":[1,2],"b":{"c":null}}').nodeCount, 6);
  assert.equal(transformJson('[1,2,3]', { action: 'compact' }).nodeCount, 4);
});

test('空输入与错误包含明确的位置，重复键不静默覆盖', () => {
  assert.deepEqual(transformJson(' \n\t '), { status: 'empty' });
  const invalid = transformJson('{\n  "a": ]\n}');
  assert.equal(invalid.status, 'error');
  assert.equal(invalid.line, 2);
  assert.equal(invalid.column, 8);
  assert.equal(invalid.position, 9);
  assert.match(transformJson('{"a":1,"a":2}').message, /Duplicate key/);
});

test('超长字符串与多节点数据保持完整', () => {
  const value = {
    message: '中文🙂'.repeat(180000),
    rows: Array.from({ length: 40000 }, (_, id) => ({ id, name: `item-${id}`, nested: [true, null] })),
    last: 'LISTOOLS_END'
  };
  const source = JSON.stringify(value);
  const formatted = transformJson(source);
  assert.equal(formatted.status, 'ready');
  assert.equal(formatted.text, JSON.stringify(value, null, 2));
  assert.equal(transformJson(formatted.text, { action: 'compact' }).text, source);
  assert.equal(formatted.inputBytes, Buffer.byteLength(source));
  assert.equal(formatted.outputBytes, Buffer.byteLength(formatted.text));
});
