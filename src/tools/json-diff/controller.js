import { errorResult, runtimeDiagnostic } from './errors.js';

export function createDiffController({ createWorker, onState, onChange }) {
  let worker;
  let prepared;
  let total = 0;
  let selected = 0;
  function cancel() {
    worker?.terminate();
    prepared?.terminate();
    worker = undefined;
    prepared = undefined;
    total = 0;
    selected = 0;
  }
  function prepare() {
    if (prepared) return;
    try {
      const current = prepared = createWorker();
      current.onerror = event => {
        event.preventDefault();
        if (prepared !== current) return;
        current.terminate();
        prepared = undefined;
      };
    } catch { /* 预加载失败时，由正式对比重试并报告任务错误。 */ }
  }
  function compare(left, right, mode = 'json', startedAt = performance.now()) {
    const ready = prepared;
    prepared = undefined;
    cancel();
    const queuedAt = performance.now();
    onState({ status: 'pending' });
    try {
      const current = worker = ready || createWorker();
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.type === 'change') {
          if (data.index === selected) onChange(data);
        } else {
          total = data.total || 0;
          if (data.status === 'error') cancel();
          onState({ ...data, startedAt, queuedAt });
        }
      };
      current.onerror = (event) => {
        event.preventDefault();
        if (worker !== current) return;
        cancel();
        onState(errorResult([runtimeDiagnostic(event, 'worker')]));
      };
      current.postMessage({ type: 'compare', left, right, mode, reuseDocuments:true });
    } catch (error) {
      cancel();
      onState(errorResult([runtimeDiagnostic(error, 'worker')]));
    }
  }
  function select(index) {
    if (!worker || !total) return;
    selected = Math.max(0, Math.min(total - 1, Math.trunc(Number(index) || 0)));
    worker.postMessage({ type: 'change', index: selected });
  }
  return { prepare, compare, cancel, select };
}
