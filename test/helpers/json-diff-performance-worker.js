import { parentPort, workerData } from 'node:worker_threads';
import { compareJson, compareText } from '../../src/tools/json-diff/core.js';
import { createEditorDiffConfig } from '../../src/tools/json-diff/editor.js';

const { kind, left, right } = workerData;
const start = performance.now();
let result;
if (kind === 'editor') {
  const config = createEditorDiffConfig([]);
  config.override('', '');
  result = { status:'ready', leftText:left, rightText:right, textChanges:config.override(left, right) };
} else result = (kind === 'text' ? compareText : compareJson)(left, right);
const elapsed = performance.now() - start;
let offset = 0;
const parts = [];
for (const change of result.textChanges || []) {
  parts.push(result.leftText.slice(offset, change.fromA), result.rightText.slice(change.fromB, change.toB));
  offset = change.toA;
}
parts.push(result.leftText?.slice(offset));
parentPort.postMessage({ status:result.status, total:result.total, counts:result.counts, ms:elapsed,
  rebuilt:parts.join('') === result.rightText, pointers:result.changes?.map(change => change.pointer),
  unchangedHighlighted:result.textChanges?.some(change => result.leftText.slice(change.fromA, change.toA).includes('KEEP_MARKER')),
  ranges:result.textChanges, sizes:[result.leftText?.length, result.rightText?.length] });
