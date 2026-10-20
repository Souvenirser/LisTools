import { processPdf } from './core.js';
self.onmessage=async({data:{taskId,input,options}})=>{
  try {const result=await processPdf({files:input,...options},event=>self.postMessage({taskId,event:'progress',...event}));self.postMessage({taskId,status:'ready',result});}
  catch(error){self.postMessage({taskId,status:'error',code:typeof error.code==='string'&&error.code.startsWith('pdf.')?error.code:'pdf.failed',params:error.params});}
};
