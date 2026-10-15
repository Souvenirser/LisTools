import test from 'node:test';
import assert from 'node:assert/strict';
import { compareJson } from '../src/tools/json-diff/core.js';

function rebuilt(result) {
  let position = 0;
  let text = '';
  for (const change of result.textChanges) {
    text += result.leftText.slice(position, change.fromA) + result.rightText.slice(change.fromB, change.toB);
    position = change.toA;
  }
  return text + result.leftText.slice(position);
}

test('置顶统计按字段路径计算，新增/删除完整节点各算一处', () => {
  const result = compareJson('{"name":"old","remove":{"a":1},"same":true}', '{"name":"new","add":{"x":1,"y":2},"same":true}');
  assert.equal(result.status, 'ready');
  assert.equal(result.total, 3);
  assert.deepEqual(result.counts, { added: 1, removed: 1, modified: 1 });
  assert.deepEqual(new Set(result.changes.map(c => c.pointer)), new Set(['/name', '/remove', '/add']));
  assert.equal(rebuilt(result), result.rightText);
});

test('忽略排版和对象键顺序，等价数值不产生误报', () => {
  const result = compareJson('{"b":1.0,"a":-0,"c":100}', ' {"c":1e2,"a":0e999,"b":1e0} ');
  assert.equal(result.total, 0);
  assert.equal(result.leftText, result.rightText);
  assert.deepEqual(result.textChanges, []);
});

test('大整数、小数及巨大指数保持精确，数字和字符串不同', () => {
  for (const [left, right] of [
    ['9007199254740992', '9007199254740993'],
    ['1.234567890123456789', '1.234567890123456788'],
    ['1e9007199254740992', '1e9007199254740993'],
    ['123', '"123"']
  ]) {
    const result = compareJson(left, right);
    assert.equal(result.total, 1, `${left} -> ${right}`);
    assert.equal(result.changes[0].pointer, '');
    assert.equal(result.leftText, left);
    assert.equal(result.rightText, right);
  }
});

test('数组按索引比较，区分根值、类型变化与 null/缺失', () => {
  assert.equal(compareJson('[1,2,3]', '[1,4,3,5]').total, 2);
  assert.equal(compareJson('{"a":null}', '{}').counts.removed, 1);
  assert.equal(compareJson('null', '{}').total, 1);
  assert.equal(compareJson('{"x":[1]}', '{"x":{"a":1}}').total, 1);
  assert.equal(compareJson('false', 'false').total, 0);
  assert.equal(compareJson('"你好"', '"你好"').total, 0);
});

test('特殊字段名、数字字段名及转义路径不会丢失或与内部数字类型冲突', () => {
  const left = '{"__proto__":{"a":1},"constructor":0,"isLosslessNumber":true,"value":"1","a/b~c":1,"0":false,"":2}';
  const right = '{"__proto__":{"a":2},"constructor":1,"isLosslessNumber":true,"value":"1","a/b~c":2,"0":false,"":2}';
  const result = compareJson(left, right);
  assert.equal(result.total, 3);
  assert.deepEqual(new Set(result.changes.map(c => c.pointer)), new Set(['/__proto__/a', '/constructor', '/a~1b~0c']));
  assert.equal(JSON.parse(result.leftText).__proto__.a, 1);
  assert.equal(JSON.parse(result.leftText).isLosslessNumber, true);
  assert.equal(compareJson('1', '{"value":"1","isLosslessNumber":true}').total, 1);
});

test('非法 JSON、重复键、空输入明确指出左右侧和位置', () => {
  const result = compareJson('{}', '{\n "a": ]\n}');
  assert.equal(result.status, 'error');
  assert.equal(result.side, 'right');
  assert.equal(result.line, 2);
  assert.equal(compareJson('{"a":1,"a":1}', '{}').status, 'error');
  assert.equal(compareJson('{"a":1,}', '{}').status, 'error');
  assert.equal(compareJson('/*x*/{}', '{}').status, 'error');
  assert.equal(compareJson('', '{}').side, 'left');
});

test('远距离变化可精确导航，所有文本差异可重建右侧全文', () => {
  const before = { rows: Array.from({ length: 20000 }, (_, id) => ({ id, text: 'x'.repeat(520) })), tail: 'END' };
  const after = structuredClone(before);
  after.rows[1].text = 'HEAD_CHANGED';
  after.rows[10000].id = -1;
  after.tail = 'TAIL_CHANGED';
  const result = compareJson(JSON.stringify(before), JSON.stringify(after));
  assert.equal(result.total, 3);
  for (const c of result.changes) {
    assert.ok(c.fromA >= 0 && c.toA <= result.leftText.length);
    assert.ok(c.fromB >= 0 && c.toB <= result.rightText.length);
  }
  assert.equal(rebuilt(result), result.rightText);
  assert.ok(result.rightText.includes('TAIL_CHANGED'));
});

test('大量不同值依然统计全部差异，并处理超长单行字符串', () => {
  const result = compareJson(JSON.stringify(Array.from({ length: 20000 }, (_, i) => i)), JSON.stringify(Array.from({ length: 20000 }, (_, i) => -i - 1)));
  assert.equal(result.total, 20000);
  assert.equal(rebuilt(result), result.rightText);
  const long = compareJson(JSON.stringify('x'.repeat(1000000) + 'a'), JSON.stringify('x'.repeat(1000000) + 'b'));
  assert.equal(long.total, 1);
  assert.equal(rebuilt(long), long.rightText);
});
