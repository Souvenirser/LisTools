import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticView } from '../src/tools/json-diff/diagnostics.js';
import { compareJson } from '../src/tools/json-diff/core.js';
import { errorResult, runtimeDiagnostic } from '../src/tools/json-diff/errors.js';

// 仅模拟本组件用到的 DOM；编辑器行为另在生产页面验收。
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.text = ''; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  before(node) { this.parentElement.append(node); }
  replaceChildren() { this.children = []; this.text = ''; }
  set textContent(text) { this.replaceChildren(); this.text = text; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, callback) { this.events[key] = callback; }
  set innerHTML(_) { throw new Error('错误片段禁止作为 HTML 插入'); }
}

test('缺少翻译键时仍展示中文左右状态和独立定位；清理后移除旧诊断', () => {
  const previous = globalThis.document;
  const ids = Object.fromEntries(['left-import', 'right-import', 'left-result-title', 'right-result-title'].map(id => [id, new Element('span')]));
  for (const node of Object.values(ids)) new Element('div').append(node);
  globalThis.document = { createElement:tag => new Element(tag), createTextNode:text => ({ textContent:text }), getElementById:id => ids[id] };
  try {
    const root = new Element('div'), sources = { left:new Element('textarea'), right:new Element('textarea') }, located = [];
    const view = createDiagnosticView({ root, sources, onLocate:issue => located.push(issue), contentName:() => 'JSON', language:() => 'zh-Hans', t:(key, params) => (params?.defaultValue || key).replace(/\{\{(\w+)\}\}/g, (_, name) => params[name]) });
    const result = compareJson('{"a":}', '[1,]');
    assert.match(view.show(result), /左右两侧/);
    assert.match(root.children[0].textContent, /左侧原 JSON/);
    assert.match(root.children[1].textContent, /右侧新 JSON/);
    assert.doesNotMatch(root.textContent, /diagnostic\./);
    for (const card of root.children) card.children.find(node => node.tag === 'button').events.click();
    assert.deepEqual(located.map(issue => issue.side), ['left', 'right']);
    assert.equal(sources.left.attributes['aria-invalid'], 'true');
    view.show(errorResult([runtimeDiagnostic(new Error('English'), 'read', 'right')]));
    assert.match(root.textContent, /导入失败/);
    assert.doesNotMatch(root.textContent, /格式错误|English|diagnostic\./);
    assert.equal(sources.right.attributes['aria-invalid'], 'false');
    view.show(errorResult([runtimeDiagnostic(new Error('English'), 'format')], { left:'valid', right:'valid' }));
    assert.match(root.textContent, /处理失败/);
    assert.doesNotMatch(root.textContent, /校验未完成|格式错误/);
    view.clear();
    assert.equal(root.hidden, true);
    assert.equal(root.children.length, 0);
  } finally { globalThis.document = previous; }
});
