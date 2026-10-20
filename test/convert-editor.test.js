import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextState } from '../src/tools/convert/editor.js';
test('编辑器输入和结果回填保留 CRLF、CR、LF、BOM、NUL，不统一换行', () => {
  const raw='\uFEFFa\r\nb\rc\n\0';
  const state=createTextState({doc:raw});
  assert.equal(state.doc.toString(),raw);
  const pasted=createTextState().update({changes:{from:0,insert:raw}}).state;
  assert.equal(pasted.doc.toString(),raw);
});
