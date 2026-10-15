import test from 'node:test';
import assert from 'node:assert/strict';
import { createJsonController } from '../src/tools/json/controller.js';

function fixture() {
  const workers = [];
  const states = [];
  const controller = createJsonController({
    onState: (state) => states.push(state),
    createWorker() {
      const worker = {
        terminated: false,
        postMessage(data) { this.input = data; },
        terminate() { this.terminated = true; }
      };
      workers.push(worker);
      return worker;
    }
  });
  return { controller, workers, states };
}

test('新输入终止旧任务，迟到的结果不能覆盖新结果', () => {
  const { controller, workers, states } = fixture();
  controller.process('{"old":1}');
  const oldHandler = workers[0].onmessage;
  controller.process('{"new":2}', { action: 'compact', indent: 4 });
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(workers[1].input, { source: '{"new":2}', action: 'compact', indent: 4 });
  oldHandler({ data: { status: 'ready', text: 'OLD' } });
  assert.equal(states.at(-1).status, 'pending');
  workers[1].onmessage({ data: { status: 'ready', text: 'NEW' } });
  assert.equal(states.at(-1).text, 'NEW');
  assert.equal(workers[1].terminated, true);
});

test('清空输入取消排队和进行中的任务，并清除旧内容', async () => {
  const { controller, workers, states } = fixture();
  controller.process('{"a":1}', { wait: 10 });
  controller.process('  ');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(workers.length, 0);
  assert.deepEqual(states.at(-1), { status: 'empty' });
  controller.process('{}');
  const oldHandler = workers[0].onmessage;
  controller.process('');
  oldHandler({ data: { status: 'ready', text: 'OLD' } });
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(states.at(-1), { status: 'empty' });
});

test('解析失败和 Worker 错误都返回错误状态', () => {
  const { controller, workers, states } = fixture();
  controller.process('bad');
  workers[0].onmessage({ data: { status: 'error', message: 'Invalid JSON', line: 1, column: 1 } });
  assert.equal(states.at(-1).status, 'error');
  assert.equal(states.at(-1).text, undefined);
  controller.process('{}');
  workers[1].onerror({ message: 'Worker unavailable', preventDefault() {} });
  assert.equal(states.at(-1).status, 'error');
  assert.match(states.at(-1).message, /Worker unavailable/);
});
