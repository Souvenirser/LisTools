import { executeConversion } from '../convert/runtime.js';
import { runRegex, limits as regexLimits } from '../regex/core.js';
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
function extractedUrl(match,input){
 let value=match.value;
 if(input[match.index-1]==='<'&&input[match.end]==='>')return value;
 const wrapper=/([（(\[【])\s*(?:(?:网址|链接|url)\s*[：:]\s*)?$/iu.exec(input.slice(0,match.index));
 const opening=wrapper?.[1],closing={'(':')','（':'）','[':']','【':'】'}[opening];
 if(closing){
  let balance=0;for(let index=0;index<value.length;index++){
   if(value[index]===opening)balance++;
   else if(value[index]===closing){if(balance===0)return value.slice(0,index);balance--;}
  }
 }
 // Markdown wrappers and direct parentheses were resolved above.
 const punctuation=/[.,;:!?，。；：！？、]+$/u,question=value.indexOf('?'),fragment=value.indexOf('#'),end=value.search(/[，。；：！？、]/u);
 const suffix=[question!==value.length-1?question:-1,fragment].filter(index=>index>=0);
 if(suffix.length&&(end<0||Math.min(...suffix)<end))return value;
 if(end>=0)value=value.slice(0,end);
 const pairs={')':'(', '）':'（',']':'[','】':'【'};const counts={};
 for(let i=0;i<value.length;i++){const ch=value[i];if(Object.values(pairs).includes(ch))counts[ch]=(counts[ch]||0)+1;else if(pairs[ch]){if(!counts[pairs[ch]])return value.slice(0,i).replace(punctuation,'');counts[pairs[ch]]--;}}
 return value.replace(punctuation,'');
}
export async function processText(request={}) {
 const {input='',operation='count',locale='en'}=request;
 if(typeof input!=='string' || !input.isWellFormed()) return failure('invalidText');
 if(encoder.encode(input).length>limits.input) return failure('inputLimit');
 try {
  let output=input,truncated=false;const summary={};
  if(['lines','case','newline'].includes(operation)) {
   const result=await executeConversion(operation,input,operation==='lines'?{...request,operation:request.lineOperation||'dedupe'}:request);
   if(result.status==='error') return failure('conversionError');
   output=await result.blob.text();
  } else if(operation==='replace') {
   if(!request.find) return failure('emptyFind');
   const pieces=input.split(request.find);
   if(encoder.encode(input).length+(pieces.length-1)*(encoder.encode(request.replacement||'').length-encoder.encode(request.find).length)>limits.output) return failure('outputLimit');
   output=pieces.join(request.replacement||'');summary.replacements=pieces.length-1;
  } else if(operation==='extract') {
   if(!['email','phone','url'].includes(request.kind)) return failure('invalidOperation');
   const result=await runRegex({input,pattern:patterns[request.kind],flags:'giu',operation:'extract'});
   if(result.status==='error') return failure('conversionError');
   let extracted=[];truncated=result.truncated;
   candidates:for(const candidate of result.matches){
    let match=candidate;
    while(match){
     if(extracted.length===regexLimits.matches){truncated=true;break candidates;}
     const value=request.kind==='url'?extractedUrl(match,input):match.value;extracted.push(value);
     if(value.length===match.value.length)break;
     const next=/https?:\/\//giu;next.lastIndex=match.index+value.length;const found=next.exec(input);
     match=found&&found.index<candidate.end?{index:found.index,end:candidate.end,value:input.slice(found.index,candidate.end)}:null;
    }
   }
   summary.matches=extracted.length;
   if(request.dedupe) extracted=[...new Set(extracted)];
   output=extracted.join('\n');summary.items=extracted.length;
  } else if(operation==='mask') {
   for(const kind of ['id','phone','email']) if(request[kind]) {
    output=output.replace(new RegExp(patterns[kind],'gu'),value=>{summary.masked=(summary.masked||0)+1;return kind==='phone'?`${value.slice(0,3)}****${value.slice(-4)}`:kind==='id'?`${value.slice(0,6)}********${value.slice(-4)}`:`${value[0]}***${value.slice(value.indexOf('@'))}`;});
   }
  } else if(operation!=='count') return failure('invalidOperation');
  if(operation==='lines'){summary.inputLines=input?input.split(/\r\n|\r|\n/).length:0;summary.outputLines=output?output.split(/\r\n|\r|\n/).length:0;}
  const blob=new Blob([output],{type:'text/plain;charset=utf-8'});
  if(blob.size>limits.output) return failure('outputLimit');
  const preview=blob.size>limits.preview?new TextDecoder().decode(await blob.slice(0,limits.preview).arrayBuffer(),{stream:true}):output;
  return {status:'ready',summary,blob,preview,outputBytes:blob.size,counts:countText(input,locale),truncated,previewTruncated:blob.size>limits.preview};
 } catch {return failure('conversionError');}
}
