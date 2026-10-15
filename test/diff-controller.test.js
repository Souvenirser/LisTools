import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiffController } from '../src/tools/json-diff/controller.js';

function fixture() {
  const workers = [], states = [], changes = [];
  const controller = createDiffController({
    createWorker() {
      const worker = { sent: [], postMessage(value) { this.sent.push(value); }, terminate() { this.terminated = true; } };
      workers.push(worker);
      return worker;
    },
    onState: value => states.push(value), onChange: value => changes.push(value)
  });
  return { controller, workers, states, changes };
}

test('新比较或取消终止旧 Worker，过期结果不能覆盖当前页面', () => {
  const { controller, workers, states } = fixture();
  controller.compare('{}', '[]');
  const old = workers[0].onmessage;
  controller.compare('{"a":1}', '{"a":2}');
  assert.equal(workers[0].terminated, true);
  old({ data: { type: 'result', status: 'ready', total: 10 } });
  assert.equal(states.at(-1).status, 'pending');
  workers[1].onmessage({ data: { type: 'result', status: 'ready', total: 1 } });
  assert.equal(states.at(-1).total, 1);
  assert.ok(!workers[1].terminated, '保留 Worker 以便按需导航');
  controller.cancel();
  assert.equal(workers[1].terminated, true);
});

test('差异导航按需请求，忽略旧编号的迟到响应', () => {
  const { controller, workers, changes } = fixture();
  controller.compare('{}', '{}');
  workers[0].onmessage({ data: { type: 'result', status: 'ready', total: 3 } });
  controller.select(1);
  controller.select(2);
  workers[0].onmessage({ data: { type: 'change', index: 1, pointer: '/old' } });
  workers[0].onmessage({ data: { type: 'change', index: 2, pointer: '/current' } });
  assert.deepEqual(workers[0].sent.at(-1), { type: 'change', index: 2 });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].pointer, '/current');
});

test('解析或 Worker 异常清理任务，后续仍可重新比较', () => {
  const { controller, workers, states } = fixture();
  controller.compare('bad', '{}');
  workers[0].onmessage({ data: { type: 'result', status: 'error', side: 'left', message: 'invalid' } });
  assert.equal(workers[0].terminated, true);
  assert.equal(states.at(-1).side, 'left');
  controller.compare('{}', '{}');
  workers[1].onerror({ message: 'failed', preventDefault() {} });
  assert.equal(states.at(-1).status, 'error');
  assert.equal(workers[1].terminated, true);
});
