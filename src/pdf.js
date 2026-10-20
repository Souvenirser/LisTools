import { addTaskGuide } from './tools/shared/task-guide.js';
import samples from './tools/pdf/examples.json';
import { t, onLanguageChange, translateDOM } from './i18n.js';
import { $, initTool, taskRunner, setStatus, showError } from './tools/shared/office.js';
import { downloadText } from './tools/shared/page.js';
import { mediaError } from './tools/images/core.js';
import './tools/pdf/style.css';
const label=(key)=>`data-i18n="pdf.${key}"`;
const modes=['merge','split','extract','reorder','delete','rotate','images'];
initTool('pdf',`<section class="tool-card" id="pdf-drop"><h2 ${label('import')}></h2><label class="media-drop" for="pdf-files" ${label('drop')}></label><input id="pdf-files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" aria-labelledby="pdf-drop"><p class="tool-note" ${label('limits')}></p></section>
<section class="tool-card"><div class="tool-fields"><label class="field"><span ${label('mode')}></span><select id="pdf-mode">${modes.map(m=>`<option value="${m}" ${label(m)}></option>`).join('')}</select></label></div><h2 ${label('queue')}></h2><ol id="pdf-queue" class="media-queue"></ol><div class="tool-actions"><button id="pdf-sort" ${label('sort')}></button><button id="pdf-clear" ${label('clear')}></button><button id="pdf-inspect" ${label('inspect')}></button></div></section>
<section class="tool-card"><div class="tool-fields"><label class="field" id="pdf-pages-field"><span ${label('pages')}></span><input id="pdf-pages" dir="ltr" placeholder="1-3,5" value="1"><span class="tool-note" ${label('rangeHelp')}></span></label><label class="field" id="pdf-rotation-field"><span ${label('rotation')}></span><select id="pdf-rotation" dir="ltr"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label class="field" id="pdf-size-field"><span ${label('pageSize')}></span><select id="pdf-page-size"><option value="a4" ${label('a4')}></option><option value="original" ${label('original')}></option></select></label><label class="field" id="pdf-orientation-field"><span ${label('orientation')}></span><select id="pdf-orientation"><option value="portrait" ${label('portrait')}></option><option value="landscape" ${label('landscape')}></option></select></label></div><p class="tool-note" ${label('preservation')}></p><div class="tool-actions"><button id="pdf-run" class="primary" ${label('run')}></button><button id="pdf-cancel" ${label('cancel')}></button></div></section>
<section class="tool-card" id="pdf-result" hidden><h2 ${label('output')}></h2><p id="pdf-output-info"></p><p id="pdf-output-order" class="tool-output" dir="ltr"></p><button id="pdf-download" ${label('download')}></button></section>`);
let files=[],result,generation=0;
function renderQueue(){
  const list=$('pdf-queue');list.replaceChildren();
  if(!files.length){const row=document.createElement('li');row.textContent=t('pdf.emptyQueue');list.append(row);}
  files.forEach((file,index)=>{
    const row=document.createElement('li'),name=document.createElement('span');name.className='media-file-name';name.textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KiB${file.pageCount!==undefined?' · '+t('pdf.pageCount',{count:file.pageCount}):''}`;row.append(name);
    for(const action of ['up','down','remove']){const button=document.createElement('button');button.textContent=t(`pdf.${action}`);button.setAttribute('aria-label',`${t(`pdf.${action}`)} · ${file.name}`);button.disabled=action==='up'&&index===0||action==='down'&&index===files.length-1;button.onclick=()=>{invalidate();if(action==='remove')files.splice(index,1);else{const other=index+(action==='up'?-1:1);[files[index],files[other]]=[files[other],files[index]];}renderQueue();};row.append(button);}
    list.append(row);
  });
}
function renderResult(){
  $('pdf-result').hidden=!result;if(!result)return;
  $('pdf-output-info').textContent=t('pdf.outputInfo',{name:result.name,count:result.pageCount,size:(result.bytes.byteLength/1024).toFixed(1)});
  $('pdf-output-order').textContent=result.order?t('pdf.outputOrder',{pages:result.order.join(', ')}):'';
}
function setBusy(value){$('pdf-run').disabled=value;$('pdf-inspect').disabled=value;$('pdf-cancel').disabled=!value;}
const runner=taskRunner(()=>new Worker(new URL('./tools/pdf/worker.js',import.meta.url),{type:'module'}),{
  timeoutMs:120000,onState:state=>setBusy(state.status==='pending'),onEvent:event=>setStatus('pdf.progress',event),
  onResult:state=>{const value=state.result;if(value.files){value.files.forEach((f,i)=>{if(files[i])files[i].pageCount=f.pageCount;});renderQueue();setStatus('pdf.inspected',{count:value.pageCount});}else{result=value;renderResult();setStatus('pdf.done',{count:value.pageCount});}}
});
function invalidate(){generation++;runner.invalidate();result=undefined;renderResult();}
async function addFiles(incoming){
  invalidate();const list=Array.from(incoming);
  if(files.length+list.length>100||files.reduce((n,f)=>n+f.size,0)+list.reduce((n,f)=>n+f.size,0)>100*1024*1024){showError(mediaError('pdf.limit'));return;}
  files.push(...list.map(blob=>({blob,name:blob.name,size:blob.size})));renderQueue();
}
async function run(inspect=false){
  invalidate();const token=generation;
  try{
    if(!files.length)throw mediaError('pdf.noFiles');const mode=inspect?'inspect':$('pdf-mode').value,isImages=mode==='images';
    if(files.some(f=>isImages?!/\.(jpe?g|png|webp)$/i.test(f.name):!/\.pdf$/i.test(f.name)))throw mediaError('pdf.fileType');
    setBusy(true);const input=[];for(const f of files){input.push({name:f.name,type:f.blob.type,bytes:await f.blob.arrayBuffer()});if(token!==generation)return;}
    runner.process({input,options:{mode,pages:$('pdf-pages').value,rotation:Number($('pdf-rotation').value),pageSize:$('pdf-page-size').value,orientation:$('pdf-orientation').value}});
  }catch(error){setBusy(false);showError(error);}
}
function updateFields(){const mode=$('pdf-mode').value;$('pdf-pages-field').hidden=!['extract','reorder','delete','rotate'].includes(mode);$('pdf-rotation-field').hidden=mode!=='rotate';$('pdf-size-field').hidden=mode!=='images';$('pdf-orientation-field').hidden=mode!=='images'||$('pdf-page-size').value==='original';}
$('pdf-files').onchange=event=>{addFiles(event.target.files);event.target.value='';};
$('pdf-drop').ondragover=event=>event.preventDefault();$('pdf-drop').ondrop=event=>{event.preventDefault();addFiles(event.dataTransfer.files);};
for(const id of ['pdf-mode','pdf-pages','pdf-rotation','pdf-page-size','pdf-orientation'])$(id).addEventListener('input',()=>{invalidate();updateFields();});
$('pdf-sort').onclick=()=>{invalidate();files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));renderQueue();};
$('pdf-clear').onclick=()=>{invalidate();files=[];renderQueue();};$('pdf-run').onclick=()=>run();$('pdf-inspect').onclick=()=>run(true);
$('pdf-cancel').onclick=()=>{generation++;runner.cancel();setBusy(false);setStatus('pdf.cancelled');};
$('pdf-download').onclick=()=>{if(result)downloadText(new Blob([result.bytes],{type:result.type}),result.name);};
onLanguageChange(()=>{renderQueue();renderResult();translateDOM($('tool-root'));});
renderQueue();setBusy(false);updateFields();

$('pdf-mode').closest('.tool-fields').hidden=true;
const pdfGuide=addTaskGuide('pdf',modes.map(id=>({id,key:`pdf.${id}`})),{
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
$('pdf-mode').addEventListener('input',()=>pdfGuide.select($('pdf-mode').value));
const pdfAdvanced=document.createElement('details');pdfAdvanced.innerHTML='<summary data-i18n="office.advanced"></summary><div class="task-choices"></div>';
$('pdf-task-merge').parentElement.after(pdfAdvanced);
for(const mode of ['reorder','delete','rotate'])pdfAdvanced.querySelector('.task-choices').append($(`pdf-task-${mode}`));
translateDOM(pdfAdvanced);
