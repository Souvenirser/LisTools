import { Change, diff } from '@codemirror/merge';
import { diffLines } from 'diff';

// CodeMirror 的超时不是硬中断；先限制输入大小，避免长行进入昂贵搜索。
export function inlineDiff(left, right, timeout = 20) {
  if (left === right) return [];
  if (Math.max(left.length, right.length) > 16384 || timeout <= 0) return [new Change(0, left.length, 0, right.length)];
  return diff(left, right, { scanLimit:100, timeout });
}

export function textDiff(left, right) {
  if (left === right) return [];
  const lines = diffLines(left, right, { maxEditLength:2000, timeout:300 });
  if (!lines) return [new Change(0, left.length, 0, right.length)];
  const changes = [], deadline = performance.now() + 100;
  let a = 0, b = 0, startA = -1, startB = -1;
  function flush() {
    if (startA < 0) return;
    const remaining = Math.min(20, deadline - performance.now());
    const inline = inlineDiff(left.slice(startA, a), right.slice(startB, b), remaining);
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
  return changes;
}
