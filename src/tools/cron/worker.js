import { evaluateCron } from './core.js';

self.onmessage=({data:{taskId,input,options={}}})=> {
  const result=evaluateCron(input,options);
  self.postMessage({...result,taskId});
};
