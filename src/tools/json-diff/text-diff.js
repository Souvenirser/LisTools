import { Change, Chunk, diff } from '@codemirror/merge';
import { Text } from '@codemirror/state';
import { diffLines } from 'diff';

const marked = (changes, coarse) => Object.defineProperty(changes, 'coarse', { value:coarse });

// CodeMirror 的超时不是硬中断；先限制输入大小，避免长行进入昂贵搜索。
export function inlineDiff(left, right, timeout = 20) {
  if (left === right) return [];
  if (Math.max(left.length, right.length) > 16384 || timeout <= 0) return marked([new Change(0, left.length, 0, right.length)], true);
  const changes = diff(left, right, { scanLimit:100, timeout });
  // Chunk exposes the library's fallback flag without repeating the search.
  const chunks = Chunk.build(Text.of(left.split('\n')), Text.of(right.split('\n')), { override:() => changes.slice() });
  // The library's wide-range budget shortcut does not set Chunk.precise.
  const coarse = chunks.some(chunk => !chunk.precise) || changes.some(change => Math.min(change.toA-change.fromA, change.toB-change.fromB) > 3200);
  return marked(changes, coarse);
}

export function textDiff(left, right) {
  if (left === right) return [];
  const lines = diffLines(left, right, { maxEditLength:2000, timeout:300 });
  if (!lines) return marked([new Change(0, left.length, 0, right.length)], true);
  const changes = [], deadline = performance.now() + 100;
  let coarse = false;
  let a = 0, b = 0, startA = -1, startB = -1;
  function flush() {
    if (startA < 0) return;
    const remaining = Math.min(20, deadline - performance.now());
    const inline = inlineDiff(left.slice(startA, a), right.slice(startB, b), remaining);
    coarse ||= Boolean(inline.coarse);
    for (const change of inline) changes.push(change.offset(startA, startB));
    startA = startB = -1;
  }
  for (const line of lines) {
    if (!line.added && !line.removed) { flush(); a += line.value.length; b += line.value.length; }
    else {
      if (startA < 0) { startA = a; startB = b; }
      if (line.removed) a += line.value.length;
      else b += line.value.length;
    }
  }
  flush();
  return marked(changes, coarse);
}
