import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { Chunk, diff } from '@codemirror/merge';
import { undo, redo } from '@codemirror/commands';
import * as editor from '../src/tools/json-diff/editor.js';

test('初次展示复用 Worker 差异，随后编辑尾部时按新局部文本增量更新', () => {
  assert.equal(typeof editor.createEditorDiffConfig, 'function');
  const left = EditorState.create({ doc: 'same line\n'.repeat(2000) + 'old tail' });
  const right = EditorState.create({ doc: 'same line\n'.repeat(2000) + 'new tail' });
  const config = editor.createEditorDiffConfig(diff(left.doc.toString(), right.doc.toString()));
  const chunks = Chunk.build(left.doc, right.doc, config);
  const transaction = right.update({ changes: { from: right.doc.length - 4, to: right.doc.length, insert: 'edited tail' } });
  const updated = Chunk.updateB(chunks, left.doc, transaction.state.doc, transaction.changes, config);
  assert.equal(updated.length, 1);
  assert.ok(updated[0].fromB > 19000);
  assert.ok(updated[0].endB <= transaction.state.doc.length);
  const end = transaction.state.doc.length;
  const restored = transaction.state.update({ changes: { from: end - 15, to: end, insert: 'old tail' } });
  const equal = Chunk.updateB(updated, left.doc, restored.state.doc, restored.changes, config);
  assert.equal(equal.length, 0);
});

test('比较后重建相同文档时保留原生撤销重做历史', () => {
  assert.equal(typeof editor.historyExtensions, 'function');
  let state = EditorState.create({ doc: 'before', extensions: editor.historyExtensions() });
  state = state.update({ changes: { from: 0, to: 6, insert: 'after' } }).state;
  state = EditorState.create({ doc: state.doc, extensions: editor.historyExtensions(state) });
  const dispatch = transaction => { state = transaction.state; };
  assert.equal(undo({ state, dispatch }), true);
  assert.equal(state.doc.toString(), 'before');
  assert.equal(redo({ state, dispatch }), true);
  assert.equal(state.doc.toString(), 'after');
});
test('导入输入沿用 CodeMirror 换行语义，支持 LF、CRLF、CR 并复用现有文档', async () => {
  const { sourceDocument } = await import('../src/tools/json-diff/editor.js');
  for (const source of ['a\nb\nc', 'a\r\nb\rc', 'a\nb\r\nc']) {
    const doc = sourceDocument(source);
    assert.equal(doc.toString(), 'a\nb\nc');
    assert.equal(doc.lines, 3);
    assert.equal(sourceDocument(doc), doc);
  }
});
