import { executeConversion } from '../convert/runtime.js';
import { runRegex } from '../regex/core.js';
export const limits={input:10*1024**2,output:100*1024**2,preview:1024**2};
const encoder=new TextEncoder();
const failure=code=>({status:'error',code:`text.${code}`});
export function countText(input,locale='en') {
 let graphemes=0,words=0;
 for(const _ of new Intl.Segmenter(locale,{granularity:'grapheme'}).segment(input)) graphemes++;
 for(const part of new Intl.Segmenter(locale,{granularity:'word'}).segment(input)) if(part.isWordLike) words++;
 return {graphemes,words,lines:input?input.split(/\r\n|\r|\n/).length:0,bytes:encoder.encode(input).length};
}
const patterns={
 email:String.raw`(?<![\w.!#$%&'*+/=?^\x60{|}~-])[A-Za-z0-9.!#$%&'*+/=?^\x60{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+`,
 phone:String.raw`(?<!\d)1[3-9]\d{9}(?!\d)`,
 url:String.raw`https?:\/\/[^\s<>"']+`,
 id:String.raw`(?<![\dA-Za-z])[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![\dA-Za-z])`
};
export async function processText(request={}) {
 const {input='',operation='count',locale='en'}=request;
 if(typeof input!=='string' || !input.isWellFormed()) return failure('invalidText');
 if(encoder.encode(input).length>limits.input) return failure('inputLimit');
 try {
  let output=input,truncated=false;
  if(['lines','case','newline'].includes(operation)) {
   const result=await executeConversion(operation,input,operation==='lines'?{...request,operation:request.lineOperation||'dedupe'}:request);
   if(result.status==='error') return failure('conversionError');
   output=await result.blob.text();
  } else if(operation==='replace') {
   if(!request.find) return failure('emptyFind');
   const pieces=input.split(request.find);
   if(encoder.encode(input).length+(pieces.length-1)*encoder.encode(request.replacement||'').length>limits.output) return failure('outputLimit');
   output=pieces.join(request.replacement||'');
  } else if(operation==='extract') {
   if(!['email','phone','url'].includes(request.kind)) return failure('invalidOperation');
   const result=await runRegex({input,pattern:patterns[request.kind],flags:'giu',operation:'extract'});
   if(result.status==='error') return failure('conversionError');
   let extracted=result.matches.map(match=>match.value);
   if(request.dedupe) extracted=[...new Set(extracted)];
   output=extracted.join('\n');truncated=result.truncated;
  } else if(operation==='mask') {
   for(const kind of ['id','phone','email']) if(request[kind]) {
    output=output.replace(new RegExp(patterns[kind],'gu'),value=>kind==='phone'?`${value.slice(0,3)}****${value.slice(-4)}`:kind==='id'?`${value.slice(0,6)}********${value.slice(-4)}`:`${value[0]}***${value.slice(value.indexOf('@'))}`);
   }
  } else if(operation!=='count') return failure('invalidOperation');
  const blob=new Blob([output],{type:'text/plain;charset=utf-8'});
  if(blob.size>limits.output) return failure('outputLimit');
  const preview=blob.size>limits.preview?new TextDecoder().decode(await blob.slice(0,limits.preview).arrayBuffer(),{stream:true}):output;
  return {status:'ready',blob,preview,outputBytes:blob.size,counts:countText(input,locale),truncated,previewTruncated:blob.size>limits.preview};
 } catch {return failure('conversionError');}
}
