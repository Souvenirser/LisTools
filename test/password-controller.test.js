import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordController } from '../src/tools/password/controller.js';

test('仅手动生成产生结果，参数失效或清空立即移除可复制内容', () => {
  const states = [];
  const controller = createPasswordController({ onChange:state => states.push(state) });
  assert.equal(controller.text(), '');
  controller.generate('characters', { customAlphabet:'ab', batch:2 });
  assert.equal(states.at(-1).values.length, 2);
  assert.match(controller.text(0), /^[ab]{20}$/);
  assert.equal(controller.text().split('\n').length, 2);
  controller.invalidate();
  assert.equal(controller.text(), ''); assert.deepEqual(states.at(-1).values, []);
  controller.generate('characters', { customAlphabet:'ab' });
  controller.clear();
  assert.equal(controller.text(), ''); assert.equal(states.at(-1).visible, false);
});

test('显隐操作保留当前结果，不会生成新密码或清空结果', () => {
  const states = [];
  const controller = createPasswordController({ onChange:state => states.push(state) });
  controller.generate('characters', { customAlphabet:'ab' });
  const result = controller.text();
  assert.equal(states.at(-1).visible, false);
  controller.toggleVisibility(); assert.equal(states.at(-1).visible, true); assert.equal(controller.text(), result);
  controller.toggleVisibility(); assert.equal(states.at(-1).visible, false); assert.equal(controller.text(), result);
});

test('新生成失败不会保留旧密码，清空同时移除错误', () => {
  const states = [];
  const controller = createPasswordController({ onChange:state => states.push(state) });
  controller.generate('characters');
  controller.generate('characters', { length:3 });
  assert.equal(controller.text(), ''); assert.deepEqual(states.at(-1).values, []);
  assert.equal(states.at(-1).error, 'length');
  controller.clear(); assert.equal(states.at(-1).error, undefined);
});
