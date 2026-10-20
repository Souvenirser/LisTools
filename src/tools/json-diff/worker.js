import { compareJson, compareText } from './core.js';
import { errorResult, runtimeDiagnostic } from './errors.js';

let changes = [];
function select(index) {
  if (!changes[index]) return;
  const { type: kind, ...location } = changes[index];
  self.postMessage({ type: 'change', kind, index, ...location });
}
self.onmessage = ({ data }) => {
  if (data.type === 'change') {
    select(data.index);
    return;
  }
  try {
    const compare = data.mode === 'text' ? compareText : compareJson;
    const { changes: resultChanges = [], ...result } = compare(data.left, data.right);
    changes = resultChanges;
    if (result.status === 'ready') {
      result.leftUnchanged = result.leftText === data.left;
      result.rightUnchanged = result.rightText === data.right;
      if (data.reuseDocuments) {
        if (result.leftUnchanged) delete result.leftText;
        if (result.rightUnchanged) delete result.rightText;
      }
    }
    if (result.status === 'ready' && result.rightText?.length > 1048576 && result.textChanges.length <= 1000) {
      const insertions = result.textChanges.map(change => result.rightText.slice(change.fromB, change.toB));
      if (insertions.reduce((sum, text) => sum + text.length, 0) < result.rightText.length / 4) {
        result.insertions = insertions;
        delete result.rightText;
      }
    }
    self.postMessage({ type: 'result', ...result });
    if (changes.length) select(0);
  } catch (error) {
    changes = [];
    self.postMessage({ type:'result', ...errorResult([runtimeDiagnostic(error, 'compare')]) });
  }
};
