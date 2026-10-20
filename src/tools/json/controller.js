export function createJsonController({ createWorker, onState }) {
  let generation = 0;
  let timer;
  let worker;

  function cancel() {
    generation += 1;
    clearTimeout(timer);
    worker?.terminate();
    worker = undefined;
  }

  function process(source, { action = 'format', indent = 2, wait = 0 } = {}) {
    cancel();
    if (!source.trim()) {
      onState({ status: 'empty' });
      return;
    }
    const current = generation;
    onState({ status: 'pending' });
    function start() {
      function finish(state) {
        if (current !== generation) return;
        worker?.terminate();
        worker = undefined;
        onState(state);
      }
      try {
        worker = createWorker();
        worker.onmessage = ({ data }) => finish(data);
        worker.onerror = (event) => {
          event.preventDefault();
          finish({ status: 'error', code: 'json.failed', message: event.message || '无法启动 JSON 解析任务' });
        };
        worker.postMessage({ source, action, indent });
      } catch (error) {
        finish({ status: 'error', code: 'json.failed', message: error.message });
      }
    }
    if (wait) timer = setTimeout(start, wait);
    else start();
  }

  return { process, cancel };
}
