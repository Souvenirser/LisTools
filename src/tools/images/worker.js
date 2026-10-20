import imageCompression from 'browser-image-compression';
import { imagePlan, imageHeader, mediaError, uniqueNames } from './core.js';
self.onmessage=async({data:{taskId,input,options}})=>{
  try {
    const results=[];let totalSize=0;
    for(let i=0;i<input.length;i++) {
      const file=input[i];imageHeader(new Uint8Array(await file.blob.arrayBuffer()));
      const bitmap=await createImageBitmap(file.blob,{imageOrientation:'from-image'});
      let resized;
      try {
        const size=imagePlan(bitmap.width,bitmap.height,options),canvas=new OffscreenCanvas(size.width,size.height),ctx=canvas.getContext('2d');
        const type=options.format==='original'?file.type:options.format;
        if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);}
        ctx.drawImage(bitmap,0,0,size.width,size.height);
        resized=await canvas.convertToBlob({type,quality:options.quality/100});
        if(resized.type!==type)throw mediaError('images.formatError');
      } finally {bitmap.close();}
      const target=Number(options.target)*1024;
      if(target>0&&resized.size>target)resized=await imageCompression(resized,{maxSizeMB:target/1024/1024,initialQuality:options.quality/100,useWebWorker:false,alwaysKeepResolution:!options.allowReduce,preserveExif:false,maxIteration:12,fileType:resized.type});
      const outputBitmap=await createImageBitmap(resized);let width,height;try{width=outputBitmap.width;height=outputBitmap.height;}finally{outputBitmap.close();}
      totalSize+=resized.size;if(totalSize>100*1024*1024)throw mediaError('images.limit');
      const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[resized.type];
      results.push({blob:resized,name:`${file.name.replace(/\.[^.]+$/,'')}.${extension}`,width,height,originalSize:file.originalSize,originalWidth:file.originalWidth,originalHeight:file.originalHeight,targetMet:!target||resized.size<=target});
      self.postMessage({taskId,event:'progress',done:i+1,total:input.length});
    }
    const names=uniqueNames(results.map(r=>r.name));results.forEach((r,i)=>r.name=names[i]);
    self.postMessage({taskId,status:'ready',result:{results}});
  } catch(error){self.postMessage({taskId,status:'error',code:typeof error.code==='string'&&error.code.startsWith('images.')?error.code:'images.failed',params:error.params});}
};
