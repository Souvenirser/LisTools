import test from 'node:test';
import assert from 'node:assert/strict';
import { bindFileDrop } from '../src/tools/json/file-drop.js';
import { transformJson } from '../src/tools/json/core.js';

function fixture() {
  const target = new EventTarget();
  const active = [];
  const files = [];
  const events = [];
  const errors = [];
  bindFileDrop(target, {
    onFile: (file, event) => { files.push(file); events.push(event); },
    onActive: (value) => active.push(value),
    onError: (message) => errors.push(message)
  });
  function send(type, dropped = [], types = ['Files']) {
    const event = new Event(type, { cancelable: true });
    event.dataTransfer = { types, files: dropped, dropEffect: 'none' };
    target.dispatchEvent(event);
    return event;
  }
  return { active, files, errors, events, send, target };
}

test('拖入 JSON 文件阻止浏览器打开文件，并交给现有解析流程', async () => {
  const { send, files, active, events, target } = fixture();
  send('dragenter');
  const over = send('dragover');
  assert.equal(over.defaultPrevented, true);
  assert.equal(over.dataTransfer.dropEffect, 'copy');
  const file = new File(['{"id":900719925474099312345}'], 'sample.JSON');
  const dropped = send('drop', [file]);
  assert.equal(dropped.defaultPrevented, true);
  assert.equal(files[0], file);
  assert.equal(events[0], dropped);
  assert.equal(events[0].target, target, '保留拖入落点，供 Diff 页面区分左右侧');
  assert.equal(active.at(-1), false);
  assert.equal(transformJson(await files[0].text()).text, '{\n  "id": 900719925474099312345\n}');
});

test('进入子元素不会让拖入提示提前消失，离开或取消后清理提示', () => {
  const { send, active } = fixture();
  send('dragenter');
  send('dragenter');
  send('dragleave');
  assert.equal(active.at(-1), true);
  send('dragleave');
  assert.equal(active.at(-1), false);
  send('dragenter');
  send('dragend');
  assert.equal(active.at(-1), false);
});

test('文字拖动不被当作文件，也不拦截浏览器默认文字操作', () => {
  const { send, files, active } = fixture();
  for (const type of ['dragenter', 'dragover', 'drop']) {
    assert.equal(send(type, [], ['text/plain']).defaultPrevented, false);
  }
  assert.deepEqual(files, []);
  assert.deepEqual(active, []);
});

test('多文件拖入给出提示，不静默覆盖当前输入', () => {
  const { send, files, errors, active } = fixture();
  send('dragenter');
  const event = send('drop', [new File(['{}'], 'a.json'), new File(['[]'], 'b.json')]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(files.length, 0);
  assert.match(errors[0], /一个/);
  assert.equal(active.at(-1), false);
});

test('大 JSON 文件完整传入，非法 JSON 由同一解析器报错', async () => {
  const { send, files } = fixture();
  const text = JSON.stringify({ text: 'x'.repeat(11000000), last: 'DROP_END' });
  send('drop', [new File([text], 'large.json')]);
  const result = transformJson(await files[0].text());
  assert.equal(result.text, JSON.stringify(JSON.parse(text), null, 2));
  send('drop', [new File(['{"a": ]'], 'broken.json')]);
  assert.equal(transformJson(await files[1].text()).status, 'error');
});
