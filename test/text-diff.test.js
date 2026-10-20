import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/tools/json-diff/core.js';

function compare(left, right) {
  assert.equal(typeof core.compareText, 'function', '提供独立于 JSON 解析的文本比较');
  return core.compareText(left, right);
}
function rebuilt(result) {
  let position = 0, text = '';
  for (const c of result.textChanges) {
    text += result.leftText.slice(position, c.fromA) + result.rightText.slice(c.fromB, c.toB);
    position = c.toA;
  }
  return text + result.leftText.slice(position);
}

test('任意文本不经过 JSON 解析，保留空格、大小写和原有内容', () => {
  const result = compare('hello world\n  keep space\nEND', 'Hello world\n keep space\nEND');
  assert.equal(result.status, 'ready');
  assert.ok(result.total > 0);
  assert.equal(result.leftText, 'hello world\n  keep space\nEND');
  assert.equal(result.rightText, 'Hello world\n keep space\nEND');
  assert.equal(rebuilt(result), result.rightText);
});

test('文本按变化行块计数，相邻修改为一处，远距离修改可逐处定位', () => {
  const left = 'head\nold a\nold b\nkeep 1\nkeep 2\nkeep 3\nkeep 4\nold tail\nend';
  const right = left.replace('old a\nold b', 'new a\nnew b').replace('old tail', 'new tail');
  const result = compare(left, right);
  assert.equal(result.total, 2);
  assert.deepEqual(result.counts, { added: 0, removed: 0, modified: 2 });
  assert.match(result.changes[1].label, /8/);
  for (const c of result.changes) {
    assert.ok(c.anchorA >= 0 && c.anchorA <= left.length);
    assert.ok(c.anchorB >= 0 && c.anchorB <= right.length);
  }
  assert.equal(rebuilt(result), right);
});

test('空文本可比较，区分新增、删除与相同内容，换行统一 LF', () => {
  assert.equal(compare('', '').total, 0);
  assert.deepEqual(compare('', 'plain text').counts, { added: 1, removed: 0, modified: 0 });
  assert.deepEqual(compare('plain text', '').counts, { added: 0, removed: 1, modified: 0 });
  assert.equal(compare('one\r\ntwo\rthree', 'one\ntwo\nthree').total, 0);
  assert.equal(compare('a\nb\nc', 'a\nb\ninsert\nc').counts.added, 1);
  assert.equal(compare('a\nb\nremove\nc', 'a\nb\nc').counts.removed, 1);
});

test('多行大文本与超长单行均保持完整，差异位置可以到达末尾', () => {
  const left = 'unchanged data\n'.repeat(100000) + 'LEFT_END';
  const right = 'unchanged data\n'.repeat(100000) + 'RIGHT_END';
  const result = compare(left, right);
  assert.equal(result.total, 1);
  assert.equal(rebuilt(result), right);
  assert.ok(result.changes[0].anchorB > 1000000);
  const long = compare('x'.repeat(1000000) + 'A', 'x'.repeat(1000000) + 'B');
  assert.equal(long.total, 1);
  assert.equal(rebuilt(long), long.rightText);
});

test('50 MB 文本末尾再次编辑后，开头、中间和末尾仍保持三块独立差异', () => {
  const lines = Array.from({ length: 200000 }, (_, i) => `${String(i).padStart(6, '0')} ${'x'.repeat(245)}`);
  const left = lines.join('\n') + '\nTEXT_END_EDIT';
  lines[0] = 'FIRST_CHANGED';
  lines[100000] = 'MIDDLE_CHANGED';
  lines[199999] = 'LAST_CHANGED';
  const right = lines.join('\n') + '\nTEXT_END';
  const result = compare(left, right);
  assert.equal(result.total, 3);
  assert.equal(rebuilt(result), right);
});
