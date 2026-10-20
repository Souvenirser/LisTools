import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { compareJson } from '../src/tools/json-diff/core.js';
import * as core from '../src/tools/json-diff/core.js';
import { errorResult, runtimeDiagnostic } from '../src/tools/json-diff/errors.js';
import * as editor from '../src/tools/json-diff/editor.js';

test('Worker 只发送汇总与按需路径，不泄露内部数值 Symbol，协议类型不被差异类型覆盖', () => {
  const messages = [];
  const self = { postMessage(value) { messages.push(structuredClone(value)); } };
  const source = fs.readFileSync(new URL('../src/tools/json-diff/worker.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
  vm.runInNewContext(source, { self, compareJson, compareText: core.compareText, errorResult, runtimeDiagnostic });
  self.onmessage({ data: { type: 'compare', left: '{"a":1}', right: '{"a":2,"b":3}' } });
  assert.equal(messages[0].type, 'result');
  assert.equal(messages[0].total, 2);
  assert.equal(messages[0].changes, undefined);
  assert.equal(messages[1].type, 'change');
  assert.ok(['CHANGE', 'CREATE'].includes(messages[1].kind));
  self.onmessage({ data: { type: 'change', index: 1 } });
  assert.equal(messages.at(-1).index, 1);
  assert.equal(messages.at(-1).type, 'change');
  self.onmessage({ data: { type: 'compare', mode: 'text', left: 'plain old', right: 'plain new' } });
  assert.equal(messages.at(-2).status, 'ready');
  assert.equal(messages.at(-2).total, 1);
  assert.equal(messages.at(-1).type, 'change');
  assert.match(messages.at(-1).label, /1/);
});

test('文本计算异常输出中文工具错误，清理旧导航数据', () => {
  const messages = [];
  const self = { postMessage:value => messages.push(value) };
  const source = fs.readFileSync(new URL('../src/tools/json-diff/worker.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
  vm.runInNewContext(source, { self, compareJson, compareText:() => { throw new Error('Synthetic compare failure'); }, errorResult, runtimeDiagnostic });
  self.onmessage({ data:{ type:'compare', left:'1', right:'2' } });
  self.onmessage({ data:{ type:'compare', mode:'text', left:'a', right:'b' } });
  const failure = messages.at(-1);
  assert.equal(failure.status, 'error');
  assert.equal(failure.side, undefined);
  assert.equal(failure.issues[0].stage, 'compare');
  assert.match(failure.message, /差异计算失败/);
  self.onmessage({ data:{ type:'change', index:0 } });
  assert.equal(messages.at(-1), failure);
});

test('大结果通过小补丁传输右侧，编辑器重建全文而非再次复制整份文档', () => {
  const messages = [], self = {postMessage:value => messages.push(structuredClone(value))};
  const source = fs.readFileSync(new URL('../src/tools/json-diff/worker.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
  vm.runInNewContext(source, {self, compareJson, compareText:core.compareText, errorResult, runtimeDiagnostic});
  const data = {rows:Array.from({length:1500}, (_,id)=>({id,text:'x'.repeat(1000)}))};
  const left=JSON.stringify(data); data.rows[1000].id=-1; const right=JSON.stringify(data);
  self.onmessage({data:{type:'compare',left,right}});
  const result=messages[0];
  assert.equal('rightText' in result, false);
  assert.ok(result.insertions.join('').length < 100);
  assert.equal(typeof editor.comparisonDocuments, 'function');
  const docs=editor.comparisonDocuments(result);
  assert.equal(docs.left.toString(), result.leftText);
  assert.equal(docs.right.toString(), compareJson(left,right).rightText);
});

test('已经排版的输入由 Worker 确认相同后复用原文档，避免重建和逐行比较', async () => {
  const {Text}=await import('@codemirror/state');
  const originals={left:Text.of(['same','old']),right:Text.of(['same','new'])};
  const messages=[],self={postMessage:value=>messages.push(value)};
  const source=fs.readFileSync(new URL('../src/tools/json-diff/worker.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
  vm.runInNewContext(source,{self,compareJson,compareText:core.compareText,errorResult,runtimeDiagnostic});
  self.onmessage({data:{type:'compare',mode:'text',left:originals.left.toString(),right:originals.right.toString(),reuseDocuments:true}});
  assert.equal(messages[0].leftUnchanged,true);assert.equal(messages[0].rightUnchanged,true);
  assert.equal('leftText' in messages[0],false);assert.equal('rightText' in messages[0],false);
  const docs=editor.comparisonDocuments(messages[0],originals);
  assert.equal(docs.left,originals.left);assert.equal(docs.right,originals.right);
});

test('仅一侧需要重新排版时，复用标记不影响另一侧文本重建', async () => {
  const { Text } = await import('@codemirror/state');
  for (const [left, right] of [['1', '{"a":2}'], ['{"a":1}', '2']]) {
    const originals = { left:Text.of([left]), right:Text.of([right]) };
    const messages = [], self = { postMessage:value => messages.push(value) };
    const source = fs.readFileSync(new URL('../src/tools/json-diff/worker.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
    vm.runInNewContext(source, { self, compareJson, compareText:core.compareText, errorResult, runtimeDiagnostic });
    self.onmessage({ data:{ type:'compare', left, right, reuseDocuments:true } });
    const docs = editor.comparisonDocuments(messages[0], originals), expected = compareJson(left, right);
    assert.equal(docs.left.toString(), expected.leftText);
    assert.equal(docs.right.toString(), expected.rightText);
  }
});
