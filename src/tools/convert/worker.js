import { executeConversion } from './runtime.js';
self.onmessage=async ({data:{taskId,toolId,input,options}})=> {
  if (toolId==='md5') {
    const { runMd5Task }=await import('./md5.js');
    const result=await runMd5Task(input,options,event=>self.postMessage({...event,taskId}));
    self.postMessage({...result,event:'task-complete',taskId});
    return;
  }
  const result=await executeConversion(toolId,input,options);
  self.postMessage({...result,taskId});
};
