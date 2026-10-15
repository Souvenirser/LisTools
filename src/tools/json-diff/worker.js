import { compareJson } from './core.js';

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
  const { changes: resultChanges = [], ...result } = compareJson(data.left, data.right);
  changes = resultChanges;
  self.postMessage({ type: 'result', ...result });
  if (changes.length) select(0);
};
