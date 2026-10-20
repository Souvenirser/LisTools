import assert from 'node:assert/strict';
import { compareJson } from '../src/tools/json-diff/core.js';

// 与页面验收相同的确定性样例，生成过程不计入比较耗时，也不写入仓库。
const data = { rows:Array.from({ length:100000 }, (_, id) => ({ id, text:'x'.repeat(480), active:true })), last:'DIFF_LARGE_END' };
const left = JSON.stringify(data);
data.rows[0].active = false; data.rows[50000].text = 'CHANGED_MIDDLE'; data.rows[99999].id = -1;
const right = JSON.stringify(data);
const runs = Number(process.argv[2] || 10), samples = [];
assert.ok(Number.isInteger(runs) && runs > 0 && runs <= 100);
for (let i = 0; i < runs; i++) {
  const result = compareJson(left, right);
  assert.equal(result.status, 'ready'); assert.equal(result.total, 3);
  let end = 0; const parts = [];
  for (const change of result.textChanges) {
    parts.push(result.leftText.slice(end, change.fromA), result.rightText.slice(change.fromB, change.toB)); end = change.toA;
  }
  parts.push(result.leftText.slice(end)); assert.equal(parts.join(''), result.rightText);
  samples.push(result.durationMs);
  console.log(JSON.stringify({ run:i + 1, ms:result.durationMs, total:result.total }));
}
samples.sort((a, b) => a - b);
const p95 = samples[Math.ceil(samples.length * .95) - 1];
console.log(JSON.stringify({ bytes:[Buffer.byteLength(left), Buffer.byteLength(right)], runs, medianMs:samples[Math.floor(samples.length / 2)], p95Ms:p95, budgetMs:2000 }));
assert.ok(p95 < 2000, `P95 ${p95} ms 超出 2000 ms`);
