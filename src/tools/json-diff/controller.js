export function createDiffController({ createWorker, onState, onChange }) {
  let worker;
  let total = 0;
  let selected = 0;
  function cancel() {
    worker?.terminate();
    worker = undefined;
    total = 0;
    selected = 0;
  }
  function compare(left, right) {
    cancel();
    onState({ status: 'pending' });
    try {
      const current = worker = createWorker();
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.type === 'change') {
          if (data.index === selected) onChange(data);
        } else {
          total = data.total || 0;
          if (data.status === 'error') cancel();
          onState(data);
        }
      };
      current.onerror = (event) => {
        event.preventDefault();
        if (worker !== current) return;
        cancel();
        onState({ status: 'error', message: event.message || '对比任务失败，请重新尝试' });
      };
      current.postMessage({ type: 'compare', left, right });
    } catch (error) {
      cancel();
      onState({ status: 'error', message: error.message });
    }
  }
  function select(index) {
    if (!worker || !total) return;
    selected = Math.max(0, Math.min(total - 1, Math.trunc(Number(index) || 0)));
    worker.postMessage({ type: 'change', index: selected });
  }
  return { compare, cancel, select };
}
