import { decodeQr } from './core.js';
self.onmessage=({data:{taskId,pixels,width,height}})=>{
 try {const text=decodeQr(pixels,width,height);self.postMessage(text===null?{taskId,status:'error',code:'qr.notFound'}:{taskId,status:'ready',text});}
 catch {self.postMessage({taskId,status:'error',code:'qr.decodeError'});}
};
