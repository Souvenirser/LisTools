import { evaluateCron } from './core.js';
import { describeCron } from './description.js';

self.onmessage=async ({data:{taskId,input,options={}}})=> {
  const result=evaluateCron(input,options);
  if(result.status==='ready') result.description=await describeCron(result.parsed,options.language);
  self.postMessage({...result,taskId});
};
