import { processText } from './core.js';
self.onmessage=async({data:{taskId,...request}})=>self.postMessage({...await processText(request),taskId});
