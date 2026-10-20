import { inlineDiff } from './text-diff.js';
import { history, historyField } from '@codemirror/commands';
import { Text } from '@codemirror/state';

export function sourceDocument(source) {
  if (typeof source !== 'string') return source;
  return Text.of((source.includes('\r') ? source.replace(/\r\n?/g, '\n') : source).split('\n'));
}

export function comparisonDocuments({ leftText, rightText, textChanges, insertions, leftUnchanged, rightUnchanged }, originals = {}) {
  const left = leftUnchanged && originals.left || Text.of(leftText.split('\n'));
  const reuseRight = rightUnchanged && originals.right;
  let right = reuseRight || (insertions ? left : Text.of(rightText.split('\n')));
  if (insertions && !reuseRight) for (let i = textChanges.length - 1; i >= 0; i--) {
    const change = textChanges[i];
    right = right.replace(change.fromA, change.toA, Text.of(insertions[i].split('\n')));
  }
  return { left, right };
}

export function historyExtensions(previousState) {
  return [history(), previousState ? historyField.init(() => previousState.field(historyField)) : []];
}

export function createEditorDiffConfig(changes) {
  let initial = changes;
  return {
    override(a, b) {
      if (initial) {
        const result = initial;
        initial = undefined;
        return result;
      }
      // 编辑时 CodeMirror 传入局部文本，不能再次使用 Worker 的全文坐标。
      return inlineDiff(a, b);
    }
  };
}
