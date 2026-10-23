import {mediaWorkspace,queueHandle,sortableQueue} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import samples from './tools/pdf/examples.json';
import { t, onLanguageChange, translateDOM } from './i18n.js';
import { $, initTool, taskRunner, clearStatus, setStatus, showError } from './tools/shared/office.js';
import { downloadText } from './tools/shared/page.js';
import { imageHeader, mediaError } from './tools/images/core.js';
import './tools/pdf/style.css';
const label=(key)=>`data-i18n="pdf.${key}"`;
const modes=['merge','split','extract','reorder','delete','rotate','images'];
initTool('pdf',`<section class="tool-card" id="pdf-drop"><h2 ${label('import')}></h2><label class="media-drop" for="pdf-files" ${label('drop')}></label><input id="pdf-files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" aria-labelledby="pdf-drop"><p class="tool-note" ${label('limits')}></p></section>
<section class="tool-card"><div class="tool-fields"><label class="field"><span ${label('mode')}></span><select id="pdf-mode">${modes.map(m=>`<option value="${m}" ${label(m)}></option>`).join('')}</select></label></div><h2 ${label('queue')}></h2><ol id="pdf-queue" class="media-queue"></ol><div class="tool-actions"><button id="pdf-sort" ${label('sort')}></button><button id="pdf-clear" ${label('clear')}></button><button id="pdf-inspect" ${label('inspect')}></button></div></section>
<section class="tool-card"><div class="tool-fields"><label class="field" id="pdf-pages-field"><span ${label('pages')}></span><input id="pdf-pages" dir="ltr" placeholder="1-3,5" value="1"><span class="tool-note" ${label('rangeHelp')}></span></label><label class="field" id="pdf-rotation-field"><span ${label('rotation')}></span><select id="pdf-rotation" dir="ltr"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label class="field" id="pdf-size-field"><span ${label('pageSize')}></span><select id="pdf-page-size"><option value="a4" ${label('a4')}></option><option value="original" ${label('original')}></option></select></label><label class="field" id="pdf-orientation-field"><span ${label('orientation')}></span><select id="pdf-orientation"><option value="portrait" ${label('portrait')}></option><option value="landscape" ${label('landscape')}></option></select></label></div><p class="tool-note" ${label('preservation')}></p><div class="tool-actions"><button id="pdf-run" class="primary" ${label('run')}></button><button id="pdf-cancel" ${label('cancel')}></button></div></section>
<section class="tool-card" id="pdf-result" hidden><h2 ${label('output')}></h2><p id="pdf-output-info"></p><p id="pdf-output-order" class="tool-output" dir="ltr"></p><button id="pdf-download" ${label('download')}></button></section>`);
let files=[],result,generation=0,busy=false,importing=false,importGeneration=0,nextFileId=0,activeFileId,processingFiles=[],importFailures=[];
addEventListener('pagehide',()=>{generation++;importGeneration++;importing=false;setBusy(false);});
const singleMode=()=>['split','extract','reorder','delete','rotate'].includes($('pdf-mode').value);
const eligibleFiles=()=>files.filter(file=>$('pdf-mode').value==='images'?/\.(jpe?g|png|webp)$/i.test(file.name):/\.pdf$/i.test(file.name));
// An unset choice permits the sole initial PDF; a cleared/removed choice requires selection.
const pdfFiles=()=>files.filter(file=>/\.pdf$/i.test(file.name));
const selectedPdf=()=>activeFileId===undefined&&pdfFiles().length===1?pdfFiles()[0]:pdfFiles().find(file=>String(file.id)===activeFileId);
const activeFiles=()=>singleMode()?[selectedPdf()].filter(Boolean):eligibleFiles();
const currentField=document.createElement('label');currentField.className='field';currentField.id='pdf-active-field';currentField.innerHTML='<span data-i18n="refinement.currentPdf"></span><select id="pdf-active-file"></select>';
$('pdf-pages-field').before(currentField);
const importErrors=document.createElement('div');importErrors.id='pdf-import-errors';importErrors.className='media-import-errors';importErrors.setAttribute('role','status');$('pdf-drop').append(importErrors);
function renderImportErrors(){importErrors.replaceChildren();for(const failure of importFailures){const row=document.createElement('p');row.className='tool-error';row.textContent=failure.name+' · '+t(failure.code);importErrors.append(row);}}
function renderQueue(){
  updateFields();setBusy(busy);renderImportErrors();
  const list=$('pdf-queue');list.replaceChildren();
  if(!files.length){const row=document.createElement('li');row.textContent=t('pdf.emptyQueue');list.append(row);}
  files.forEach((file,index)=>{
    const row=document.createElement('li'),name=document.createElement('span');row.className='media-queue-row';name.className='media-file-name';name.textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KiB${/\.pdf$/i.test(file.name)?file.pageCount!==undefined?' · '+t('pdf.pageCount',{count:file.pageCount}):' · '+t('uiText.unknownPages'):''}`;if(!(singleMode()?activeFiles():eligibleFiles()).includes(file))name.textContent+=' · '+t('refinement.notUsed');row.append(name);
    for(const action of ['up','down','remove']){const button=document.createElement('button');button.textContent=t(`pdf.${action}`);button.setAttribute('aria-label',`${t(`pdf.${action}`)} · ${file.name}`);button.disabled=action==='up'&&index===0||action==='down'&&index===files.length-1;button.onclick=()=>{invalidate();if(action==='remove')files.splice(index,1);else{const other=index+(action==='up'?-1:1);[files[index],files[other]]=[files[other],files[index]];}renderQueue();};row.append(button);}
    row.append(queueHandle(file.name));list.append(row);
  });
}
function renderResult(){
  $('pdf-result').hidden=!result;$('pdf-download').classList.add('primary');$('pdf-run').classList.toggle('primary',!result&&activeFiles().length>0);if(!result)return;
  $('pdf-output-info').textContent=t('pdf.outputInfo',{name:result.name,count:result.pageCount,size:(result.bytes.byteLength/1024).toFixed(1)});
  $('pdf-output-order').textContent=result.order?t('pdf.outputOrder',{pages:result.order.join(', ')}):'';
}
function setBusy(value){busy=value;$('pdf-run').disabled=value||importing||!activeFiles().length;$('pdf-inspect').disabled=value||importing||!files.some(file=>/\.pdf$/i.test(file.name));$('pdf-active-file').disabled=value||importing;$('pdf-cancel').disabled=!value&&!importing;}
const runner=taskRunner(()=>new Worker(new URL('./tools/pdf/worker.js',import.meta.url),{type:'module'}),{
  timeoutMs:120000,onState:state=>setBusy(state.status==='pending'),onEvent:event=>setStatus('pdf.progress',event),
  onResult:state=>{const value=state.result;for(const [index,info] of (value.files||value.sourceFiles||[]).entries()){if(files.includes(processingFiles[index]))processingFiles[index].pageCount=info.pageCount;}renderQueue();if(value.files)setStatus('pdf.inspected',{count:value.pageCount});else{result=value;renderResult();setStatus('pdf.done',{count:value.pageCount});}}
});
function invalidate(){generation++;runner.invalidate();result=undefined;renderResult();}
async function addFiles(incoming){
  const list=Array.from(incoming);if(!list.length)return;
  if(list.length+files.length>100||list.reduce((n,file)=>n+file.size,0)+files.reduce((n,file)=>n+file.size,0)>100*1024*1024){showError(mediaError('pdf.limit'));return;}
  const token=++importGeneration,mode=$('pdf-mode').value;importing=true;setBusy(busy);const accepted=[],rejected=[];
  try{
    for(const blob of list){
      if(mode==='images'?!/\.(jpe?g|png|webp)$/i.test(blob.name):!/\.pdf$/i.test(blob.name)){rejected.push({name:blob.name,code:'pdf.fileType'});continue;}
      try{
        if(mode==='images'){imageHeader(new Uint8Array(await blob.arrayBuffer()));}
        else if(!new TextDecoder('latin1').decode(await blob.slice(0,1024).arrayBuffer()).includes('%PDF-'))throw mediaError('pdf.invalid');
        accepted.push(blob);
      }catch(error){rejected.push({name:blob.name,code:mode==='images'?'pdf.imageDecode':'pdf.invalid'});}
      if(token!==importGeneration)return;
    }
    if(token!==importGeneration)return;
    importFailures=rejected;renderImportErrors();
    if(!accepted.length)return;
    if(files.length+accepted.length>100||files.reduce((n,f)=>n+f.size,0)+accepted.reduce((n,f)=>n+f.size,0)>100*1024*1024){showError(mediaError('pdf.limit'));return;}
    invalidate();files.push(...accepted.map(blob=>({id:++nextFileId,blob,name:blob.name,size:blob.size})));renderQueue();
  }finally{if(token===importGeneration){importing=false;setBusy(busy);}}
}
async function run(inspect=false){
  if(importing)return;
  invalidate();const token=generation;
  let reading;
  try{
    const mode=inspect?'inspect':$('pdf-mode').value;processingFiles=inspect?files.filter(file=>/\.pdf$/i.test(file.name)):activeFiles();
    if(!processingFiles.length)throw mediaError(singleMode()?'pdf.singleFile':'pdf.noFiles');
    setBusy(true);const input=[];for(const f of processingFiles){reading=f;input.push({name:f.name,type:f.blob.type,bytes:await f.blob.arrayBuffer()});if(token!==generation)return;}
    runner.process({input,options:{mode,pages:$('pdf-pages').value,rotation:Number($('pdf-rotation').value),pageSize:$('pdf-page-size').value,orientation:$('pdf-orientation').value}});
  }catch(error){if(token!==generation)return;setBusy(false);showError(error.code?error:mediaError('office.fileReadError',{name:reading?.name||''}));}
}
function updateFields(){
 const mode=$('pdf-mode').value,eligible=pdfFiles();if(!eligible.length)activeFileId=undefined;else if(activeFileId!=null&&!eligible.some(file=>String(file.id)===activeFileId))activeFileId=null;
 const select=$('pdf-active-file');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=t('refinement.choosePdf');select.append(placeholder);for(const file of eligible){const option=document.createElement('option');option.value=String(file.id);option.textContent=file.name;select.append(option);}select.value=selectedPdf()?String(selectedPdf().id):'';
 currentField.hidden=!singleMode();$('pdf-run').textContent=t('ux.pdfRun',{action:t('pdf.'+mode),count:activeFiles().length});$('pdf-files').accept=mode==='images'?'image/jpeg,image/png,image/webp':'application/pdf';$('pdf-files').multiple=!singleMode();$('pdf-pages-field').hidden=!['extract','reorder','delete','rotate'].includes(mode);$('pdf-rotation-field').hidden=mode!=='rotate';$('pdf-size-field').hidden=mode!=='images';$('pdf-orientation-field').hidden=mode!=='images'||$('pdf-page-size').value==='original';
}
$('pdf-active-file').onchange=()=>{activeFileId=$('pdf-active-file').value||null;invalidate();updateFields();setBusy(busy);};
$('pdf-files').onchange=event=>{addFiles(event.target.files);event.target.value='';};
$('pdf-drop').ondragover=event=>event.preventDefault();$('pdf-drop').ondrop=event=>{event.preventDefault();addFiles(event.dataTransfer.files);};
for(const id of ['pdf-mode','pdf-pages','pdf-rotation','pdf-page-size','pdf-orientation'])$(id).addEventListener('input',()=>{if(id==='pdf-mode'){importGeneration++;importing=false;}invalidate();renderQueue();});
$('pdf-sort').onclick=()=>{invalidate();files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));renderQueue();};
$('pdf-clear').onclick=()=>{importGeneration++;importing=false;importFailures=[];activeFileId=undefined;invalidate();files=[];renderQueue();clearStatus();};$('pdf-run').onclick=()=>run();$('pdf-inspect').onclick=()=>run(true);
$('pdf-cancel').onclick=()=>{generation++;importGeneration++;importing=false;runner.cancel();setBusy(false);setStatus('pdf.cancelled');};
$('pdf-download').onclick=()=>{if(result)downloadText(new Blob([result.bytes],{type:result.type}),result.name);};
onLanguageChange(()=>{renderQueue();renderResult();translateDOM($('tool-root'));updateFields();});
renderQueue();setBusy(false);updateFields();

$('pdf-mode').closest('.tool-fields').hidden=true;
const pdfGuide=addTaskGuide('pdf',modes.map(id=>({id,key:id==='split'?'refinement.shortSplit':`pdf.${id}`})),{
 hasContent:()=>files.length>0||Boolean(result),
 choose(mode){$('pdf-mode').value=mode;$('pdf-mode').dispatchEvent(new Event('input'));},
 async example(mode){
  invalidate();files=[];renderQueue();$('pdf-mode').value=mode;updateFields();
  if(mode==='images'){
   const token=generation,canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;const context=canvas.getContext('2d');context.fillStyle='#e6f4fe';context.fillRect(0,0,640,400);context.fillStyle='#0d74ce';context.font='100px sans-serif';context.fillText('PDF',200,240);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==generation)return;
   await addFiles([new File([blob],'sample.png',{type:'image/png'})]);
  }else{
   const selected=mode==='merge'?samples:samples.slice(0,1);
   await addFiles(selected.map((value,index)=>new File([Uint8Array.from(atob(value),c=>c.charCodeAt(0))],`sample-${index+1}.pdf`,{type:'application/pdf'})));
  }
  $('pdf-pages').value=mode==='reorder'?'3,1,2':mode==='delete'?'2':mode==='rotate'?'1':'1-2';
  await run();
 }
});
$('pdf-mode').addEventListener('input',()=>pdfGuide.select($('pdf-mode').value));$('pdf-run').removeAttribute('data-i18n');
const pdfAdvanced=document.createElement('details');pdfAdvanced.innerHTML='<summary data-i18n="uiText.pageAdjust"></summary><div class="task-choices"></div>';
$('pdf-task-merge').parentElement.after(pdfAdvanced);
for(const mode of ['reorder','delete','rotate'])pdfAdvanced.querySelector('.task-choices').append($(`pdf-task-${mode}`));
translateDOM(pdfAdvanced);

mediaWorkspace('pdf');
$('pdf-run').closest('.workspace-options').prepend($('pdf-result'));$('pdf-result').classList.add('media-inline-result');
const outputOrder=document.createElement('details');outputOrder.innerHTML='<summary data-i18n="refinement.outputOrder"></summary>';$('pdf-output-order').before(outputOrder);outputOrder.append($('pdf-output-order'));outputOrder.before($('pdf-download'));translateDOM(outputOrder);
void sortableQueue($('pdf-queue'),(from,to)=>{invalidate();files.splice(to,0,files.splice(from,1)[0]);renderQueue();});
