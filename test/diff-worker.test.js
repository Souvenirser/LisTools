import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compareJson } from '../src/tools/json-diff/core.js';

test('Worker 只发送汇总与按需路径，不泄露内部数值 Symbol，协议类型不被差异类型覆盖', () => {
  const messages = [];
  const self = { postMessage(value) { messages.push(structuredClone(value)); } };
  const source = fs.readFileSync(new URL('../src/tools/json-diff/worker.js', import.meta.url), 'utf8').replace(/^import .*;$/m, '');
  vm.runInNewContext(source, { self, compareJson });
  self.onmessage({ data: { type: 'compare', left: '{"a":1}', right: '{"a":2,"b":3}' } });
  assert.equal(messages[0].type, 'result');
  assert.equal(messages[0].total, 2);
  assert.equal(messages[0].changes, undefined);
  assert.equal(messages[1].type, 'change');
  assert.ok(['CHANGE', 'CREATE'].includes(messages[1].kind));
  self.onmessage({ data: { type: 'change', index: 1 } });
  assert.equal(messages.at(-1).index, 1);
  assert.equal(messages.at(-1).type, 'change');
});
