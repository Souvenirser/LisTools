import { PDFDocument, degrees } from 'pdf-lib';
import { zipSync } from 'fflate';
import { imageHeader, mediaError } from '../images/core.js';
const fail=code=>{throw mediaError(`pdf.${code}`);};
async function fromFile(file,task){try{return await task();}catch(error){error.params={...error.params,name:file.name};throw error;}}
export function parsePages(text,count) {
  if(!String(text).trim())fail('rangeError');const pages=[];
  for(const part of String(text).split(',')) {
    const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!match)fail('rangeError');
    const start=Number(match[1]),end=Number(match[2]||match[1]);
    if(start<1||end<start||end>count||!Number.isSafeInteger(end))fail('rangeError');
    for(let p=start;p<=end;p++){if(pages.includes(p-1))fail('rangeError');pages.push(p-1);}
  }
  return pages;
}
async function load(bytes) {
  try {const pdf=await PDFDocument.load(bytes);if(pdf.isEncrypted)fail('encrypted');if(pdf.getPageCount()>1000)fail('limit');return pdf;}
  catch(error){if(error.code)throw error;if(/encrypt/i.test(error.message))fail('encrypted');fail('invalid');}
}
async function embedImage(pdf,file) {
  const bytes=new Uint8Array(file.bytes);let header;
  try{header=imageHeader(bytes);}catch(error){fail(error.code==='images.dimensions'?'limit':'imageDecode');}
  // Native decoding honors phone EXIF orientation. Re-encoding also removes metadata.
  if(typeof createImageBitmap==='function'&&(header.type!=='image/png')) {
    const bitmap=await createImageBitmap(new Blob([bytes],{type:header.type}),{imageOrientation:'from-image'});
    try {const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,0,0);return pdf.embedPng(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer());}finally{bitmap.close();}
  }
  if(header.type==='image/png')return pdf.embedPng(bytes);
  if(header.type==='image/jpeg')return pdf.embedJpg(bytes);
  fail('imageDecode');
}
export async function processPdf({files,mode,pages='',rotation=90,pageSize='a4',orientation='portrait'},progress=()=>{}) {
  if(!Array.isArray(files)||!files.length)fail('noFiles');
  if(files.length>100||files.reduce((n,f)=>n+f.bytes.byteLength,0)>100*1024*1024)fail('limit');
  const out=await PDFDocument.create();let count=0,outputOrder,sourceFiles;
  if(mode==='images') {
    let totalPixels=0;for(const file of files){const header=await fromFile(file,()=>{try{return imageHeader(new Uint8Array(file.bytes));}catch(error){fail(error.code==='images.dimensions'?'limit':'imageDecode');}});totalPixels+=header.width*header.height;if(totalPixels>120_000_000)fail('limit');}
    for(let i=0;i<files.length;i++) {
      const image=await fromFile(files[i],()=>embedImage(out,files[i]));let w=image.width,h=image.height;
      if(pageSize==='a4'){[w,h]=orientation==='landscape'?[841.89,595.28]:[595.28,841.89];}
      const page=out.addPage([w,h]),scale=Math.min(w/image.width,h/image.height);page.drawImage(image,{x:(w-image.width*scale)/2,y:(h-image.height*scale)/2,width:image.width*scale,height:image.height*scale});progress({done:i+1,total:files.length});
    }
    count=files.length;outputOrder=files.map(f=>f.name);
  } else {
    const docs=[];for(let i=0;i<files.length;i++){docs.push(await fromFile(files[i],()=>load(files[i].bytes)));progress({done:i+1,total:files.length});}
    sourceFiles=docs.map((doc,index)=>({name:files[index].name,pageCount:doc.getPageCount()}));
    count=docs.reduce((n,d)=>n+d.getPageCount(),0);if(count>1000)fail('limit');
    if(mode==='inspect')return {files:docs.map((d,i)=>({name:files[i].name,pageCount:d.getPageCount()})),pageCount:count};
    if(mode==='merge') {outputOrder=[];for(let i=0;i<docs.length;i++){const pdf=docs[i];for(const page of await out.copyPages(pdf,pdf.getPageIndices()))out.addPage(page);outputOrder.push(...pdf.getPageIndices().map(p=>`${files[i].name}: ${p+1}`));}}
    else {
      if(docs.length!==1)fail('singleFile');const pdf=docs[0],all=pdf.getPageIndices();
      if(mode==='split') {
        const entries={};let totalBytes=0;for(let i=0;i<count;i++){const part=await PDFDocument.create();part.addPage((await part.copyPages(pdf,[i]))[0]);const bytes=await part.save();totalBytes+=bytes.length;if(totalBytes>100*1024*1024)fail('limit');entries[`page-${i+1}.pdf`]=bytes;progress({done:i+1,total:count});}
        const bytes=zipSync(entries,{level:0});if(bytes.length>100*1024*1024)fail('limit');return {bytes,name:'pages.zip',type:'application/zip',pageCount:count,order:all.map(i=>i+1),sourceFiles};
      }
      const selected=parsePages(pages,count);let order;
      if(mode==='extract'||mode==='reorder') {order=selected;if(mode==='reorder'&&selected.length!==count)fail('completeOrder');}
      else if(mode==='delete')order=all.filter(p=>!selected.includes(p));
      else if(mode==='rotate'){if(![90,180,270].includes(Number(rotation)))fail('rotationError');order=all;}
      else fail('modeError');
      if(!order.length)fail('empty');
      const copied=await out.copyPages(pdf,order);copied.forEach((page,i)=>{if(mode==='rotate'&&selected.includes(order[i]))page.setRotation(degrees((page.getRotation().angle+Number(rotation))%360));out.addPage(page);});
      outputOrder=order.map(p=>p+1);count=order.length;
    }
  }
  const bytes=await out.save();if(bytes.length>100*1024*1024)fail('limit');
  return {bytes,name:`${mode}.pdf`,type:'application/pdf',pageCount:count,order:outputOrder,sourceFiles};
}
