import {runRegex} from './core.js';
self.onmessage=async ({data})=> {
  const result=await runRegex(data);
  self.postMessage({...result,taskId:data.taskId});
};
