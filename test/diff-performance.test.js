import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

function run(kind, left, right, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./helpers/json-diff-performance-worker.js', import.meta.url), { workerData:{ kind, left, right } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error(`${kind} 比较超时 ${timeout} ms`)); }, timeout);
    worker.once('message', result => { clearTimeout(timer); void worker.terminate(); resolve(result); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

test('50 MB JSON 三处远距离差异在两秒内计算，差异仍可重建右侧全文', async () => {
  const data = { rows:Array.from({ length:100000 }, (_, id) => ({ id, text:'x'.repeat(480), active:true })), last:'DIFF_LARGE_END' };
  const left = JSON.stringify(data);
  data.rows[0].active = false; data.rows[50000].text = 'CHANGED_MIDDLE'; data.rows[99999].id = -1;
  const result = await run('json', left, JSON.stringify(data), 10000);
  assert.equal(result.status, 'ready');
  assert.equal(result.total, 3);
  assert.deepEqual(new Set(result.pointers), new Set(['/rows/0/active', '/rows/50000/text', '/rows/99999/id']));
  assert.equal(result.rebuilt, true);
  assert.ok(result.ms < 2000, `实际计算耗时 ${Math.round(result.ms)} ms，目标 < 2000 ms`);
});

test('1 MB 超长单行在 JSON、文本和编辑器实时比较中均不会进入失控字符搜索', async () => {
  const left = 'A' + 'x'.repeat(500000) + 'B' + 'x'.repeat(500000) + 'C';
  const right = 'D' + 'x'.repeat(500000) + 'E' + 'x'.repeat(500000) + 'F';
  for (const kind of ['json', 'text', 'editor']) {
    const result = await run(kind, kind === 'json' ? JSON.stringify(left) : left, kind === 'json' ? JSON.stringify(right) : right, 2000);
    assert.equal(result.status, 'ready');
    assert.equal(result.rebuilt, true);
    assert.ok(result.ms < 1000, `${kind}: ${result.ms} ms`);
  }
});

test('变化长行的粗粒度标记不吞掉两侧未变的相邻行', async () => {
  const left = 'UNCHANGED_BEFORE\nA' + 'x'.repeat(1000000) + 'B\nUNCHANGED_AFTER';
  const right = 'UNCHANGED_BEFORE\nC' + 'x'.repeat(1000000) + 'D\nUNCHANGED_AFTER';
  const result = await run('text', left, right, 2000);
  assert.equal(result.rebuilt, true);
  assert.equal(result.total, 1);
  for (const range of result.ranges) {
    assert.ok(range.fromA >= 'UNCHANGED_BEFORE\n'.length);
    assert.ok(range.toA <= left.indexOf('UNCHANGED_AFTER'));
  }
});

test('大量修改并新增、删除字段时，预算回退仍能重建全文且不把未变字段整片染色', async () => {
  const rows = Array.from({ length:3000 }, (_, id) => ({ id, kept:'KEEP_MARKER' }));
  const left = { before:rows, remove:1, unchanged:'KEEP_MARKER' };
  const right = { before:rows.map(row => ({ ...row, id:-row.id - 1 })), add:2, unchanged:'KEEP_MARKER' };
  const result = await run('json', JSON.stringify(left), JSON.stringify(right));
  assert.equal(result.total, 3002);
  assert.equal(result.rebuilt, true);
  assert.equal(result.unchangedHighlighted, false);
});
