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

test('切换文本模式发送模式信息，并隔离旧 JSON 结果', () => {
  const { controller, workers, states } = fixture();
  controller.compare('{}', '{}');
  const old = workers[0].onmessage;
  controller.compare('plain left', 'plain right', 'text');
  assert.deepEqual(workers[1].sent[0], { type: 'compare', left: 'plain left', right: 'plain right', mode: 'text', reuseDocuments:true });
  old({ data: { type: 'result', status: 'ready', total: 99 } });
  assert.equal(states.at(-1).status, 'pending');
});

test('Worker 错误不透传英文，不把两侧数据判为不合法，失败后仍可重试', () => {
  const { controller, workers, states } = fixture();
  controller.compare('{}', '{}');
  workers[0].onerror({ message: 'Failed to fetch dynamically imported module', preventDefault() {} });
  const failure = states.at(-1);
  assert.match(failure.message, /任务/);
  assert.doesNotMatch(failure.message, /Failed|fetch/);
  assert.equal(failure.issues?.[0].stage, 'worker');
  assert.deepEqual(failure.validation, { left: 'unchecked', right: 'unchecked' });
  controller.compare('{}', '{}');
  assert.equal(states.at(-1).status, 'pending');
});

test('总耗时从主线程发起时计时，导入开始时间可传递，旧任务不能更新计时', () => {
  const { controller, workers, states } = fixture();
  const importedAt = performance.now() - 123;
  controller.compare('{}', '{}', 'json', importedAt);
  workers[0].onmessage({ data:{ status:'ready', total:0, durationMs:10 } });
  assert.equal(states.at(-1).startedAt, importedAt);
  assert.ok(states.at(-1).queuedAt >= importedAt);
  const before = performance.now();
  controller.compare('{}', '{}');
  workers[1].onmessage({ data:{ status:'ready', total:0, durationMs:10 } });
  assert.ok(states.at(-1).startedAt >= before);
});

test('文件读取时预加载 Worker，正式对比复用它，取消和加载失败均可清理', () => {
  const { controller, workers, states } = fixture();
  controller.prepare();
  controller.compare('{}', '{}');
  assert.equal(workers.length, 1);
  assert.equal(workers[0].terminated, undefined);
  assert.equal(workers[0].sent[0].type, 'compare');
  controller.cancel();
  assert.equal(workers[0].terminated, true);
  controller.prepare();
  workers[1].onerror({ preventDefault() {} });
  assert.equal(workers[1].terminated, true);
  controller.compare('{}', '{}');
  assert.equal(workers.length, 3);
  assert.equal(states.at(-1).status, 'pending');
});
