export function createConversionController({createWorker,onState,onEvent=()=>{},timeoutMs=0}) {
  let generation=0, timer, deadline, worker;
  function stop() {
    generation++;
    clearTimeout(timer);
    clearTimeout(deadline);
    worker?.terminate(); worker=undefined;
  }
  function invalidate(status='idle'){stop();onState({status});}
  function process(request,{auto=false,wait=350}={}) {
    stop();
    if (auto && (typeof request.input !== 'string' || new TextEncoder().encode(request.input).length > 256*1024 || request.toolId==='md5' && !request.input)){onState({status:'idle'});return;}
    const taskId=generation;
    onState({status:'pending'});
    function start() {
      function finish(state) {
        if (taskId !== generation) return;
        generation++;
        clearTimeout(deadline);
        worker?.terminate(); worker=undefined;
        onState(state);
      }
      try {
        worker=createWorker();
        worker.onmessage=({data})=> {
          if (data.taskId !== taskId || taskId !== generation) return;
          if (['progress','item-complete'].includes(data.event)) onEvent(data);
          else finish(data);
        };
        worker.onerror=event=> { event.preventDefault(); finish({status:'error',errorCode:'worker',message:'转换任务失败，请重试'}); };
        worker.postMessage({...request,taskId});
        if (timeoutMs) deadline=setTimeout(()=>finish({status:'error',code:'TaskTimeout',message:'任务超时，请缩小输入后重试 / Task timed out; reduce the input and retry.'}),timeoutMs);
      } catch { finish({status:'error',errorCode:'start',message:'无法启动转换任务，请重试'}); }
    }
    if (auto) timer=setTimeout(start,wait); else start();
  }
  return {process,invalidate,cancel:()=>invalidate('cancelled')};
}
