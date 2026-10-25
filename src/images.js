import {mediaWorkspace,queueHandle,sortableQueue} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import Cropper from 'cropperjs';
import { zipSync } from 'fflate';
import { t, onLanguageChange, translateDOM } from './i18n.js';
import { $, initTool, taskRunner, setStatus, clearStatus, showError } from './tools/shared/office.js';
import { downloadText } from './tools/shared/page.js';
import { imageHeader, checkDimensions, mediaError } from './tools/images/core.js';
import './tools/images/style.css';
const label=key=>`data-i18n="images.${key}"`;
const numeric=(id,key,value,min,max)=>`<label class="field"><span ${label(key)}></span><input type="number" dir="ltr" id="${id}" value="${value}" min="${min}" max="${max}"></label>`;
initTool('images',`<section class="tool-card" id="images-drop"><h2 ${label('import')}></h2><label class="media-drop" for="images-files" ${label('drop')}></label><input id="images-files" type="file" accept="image/jpeg,image/png,image/webp" multiple><p class="tool-note" ${label('limits')}></p></section>
<section class="tool-card"><h2 ${label('queue')}></h2><ol id="images-queue" class="media-queue"></ol><button id="images-clear" ${label('clear')}></button></section>
<section class="tool-card" id="images-crop-panel" hidden><h2 ${label('crop')}></h2><p id="images-crop-name"></p><p class="tool-note" ${label('cropNote')}></p><div id="images-crop-container" class="images-crop-container"></div><div class="tool-fields"><label class="field"><span ${label('ratio')}></span><select id="images-ratio"><option value="0" ${label('free')}></option><option value="1" ${label('square')}></option><option value="1.3333333333333333">4:3</option><option value="1.7777777777777777">16:9</option><option value="0.75">3:4</option><option value="0.5625">9:16</option></select></label></div><div class="tool-actions"><button id="images-rotate" ${label('rotate')}></button><button id="images-flip-h" ${label('flipH')}></button><button id="images-flip-v" ${label('flipV')}></button><button id="images-apply" ${label('applyCrop')}></button><button id="images-reset" ${label('resetCrop')}></button></div></section>
<section class="tool-card" id="images-settings"><h2 ${label('settings')}></h2><div class="tool-fields">${numeric('images-width','width',0,0,16384)}${numeric('images-height','height',0,0,16384)}${numeric('images-scale','scale',100,1,400)}${numeric('images-quality','quality',80,1,100)}${numeric('images-target','target',0,0,102400)}<label class="field"><span ${label('format')}></span><select id="images-format"><option value="original" ${label('original')}></option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label></div><label class="check-label"><input id="images-aspect" type="checkbox" checked><span ${label('aspect')}></span></label><label class="check-label"><input id="images-reduce" type="checkbox"><span ${label('allowReduce')}></span></label><p class="tool-note" ${label('jpegNotice')}></p><div class="tool-actions"><button id="images-run" class="primary" ${label('run')}></button><button id="images-cancel" ${label('cancel')}></button></div></section>
<section class="tool-card" id="images-results" hidden><h2 ${label('results')}></h2><div id="images-output" class="images-output"></div><button id="images-zip" ${label('downloadZip')}></button></section>`);
let resultFailedCount=0;
let nextFileId=0,importFailures=[],processFailures=[],cropGeneration=0;
let files=[],results=[],cropper,selected,generation=0,importGeneration=0,importing=false,processing=false,outputUrls=[],cropDirty=false,imageTask='compress';
function releaseResults(){for(const url of outputUrls)URL.revokeObjectURL(url);outputUrls=[];results=[];$('images-results').hidden=true;const summary=$('images-result-summary');if(summary)summary.hidden=true;$('images-output').replaceChildren();}
function renderQueue(){
  const list=$('images-queue');list.replaceChildren();
  if(!files.length){const row=document.createElement('li');row.textContent=t('images.empty');list.append(row);}
  files.forEach((file,index)=>{
    const row=document.createElement('li'),thumbnail=document.createElement('img'),name=document.createElement('span');row.className='media-queue-row';row.classList.toggle('is-selected',imageTask==='crop'&&file===selected);if(imageTask==='crop'&&file===selected)row.setAttribute('aria-current','true');thumbnail.src=file.url;thumbnail.alt='';thumbnail.className='images-thumb';name.className='media-file-name';name.textContent=file.name;const info=document.createElement('span');info.className='media-file-info';info.textContent=`${t('images.summary',{width:file.width,height:file.height,size:(file.blob.size/1024).toFixed(1)})}${file.crop?' · '+t('images.cropped'):''}`;name.append(' ',info);row.append(thumbnail,name);const operations=document.createElement('details');operations.className='media-file-actions';operations.open=!matchMedia('(max-width:760px)').matches;const summary=document.createElement('summary');summary.textContent=t('direct.files.fileActions');summary.setAttribute('aria-label',t('direct.files.fileActions')+' · '+file.name);const actions=document.createElement('div');actions.className='tool-actions';operations.append(summary,actions);row.append(operations);
    for(const action of ['select','remove']){const button=document.createElement('button');button.textContent=t(`images.${action}`);button.setAttribute('aria-label',`${t(`images.${action}`)} · ${file.name}`);button.onclick=()=>{if(action==='select'){if(file!==selected&&cropDirty&&!confirm(t('direct.files.discardCrop')))return;imageGuide.select('crop');chooseImageTask('crop',file);}else{invalidate();if(selected===file)closeCrop();files=files.filter(f=>f!==file);URL.revokeObjectURL(file.url);renderQueue();}};actions.append(button);}
    for(const [action,delta] of [['up',-1],['down',1]]){const button=document.createElement('button');button.textContent=t('pdf.'+action);button.setAttribute('aria-label',t('pdf.'+action)+' · '+file.name);button.disabled=index+delta<0||index+delta>=files.length;button.onclick=()=>{invalidate();files.splice(index+delta,0,files.splice(index,1)[0]);renderQueue();};actions.append(button);}row.append(queueHandle(file.name));list.append(row);
  });
  for(const failure of [...importFailures,...processFailures]){const row=document.createElement('li');row.className='is-error';row.textContent=`${failure.name||files.find(file=>file.id===failure.fileId)?.name||''} · ${t(failure.code,failure.params)}`;list.append(row);}
  updateQuality();setBusy(processing);
}
function renderResults(){
  $('images-output').replaceChildren();for(const url of outputUrls)URL.revokeObjectURL(url);outputUrls=[];$('images-results').hidden=!results.length;$('images-zip').disabled=!results.length;renderResultSummary();
  results.forEach(result=>{
    const card=document.createElement('article');card.className='images-result-card';const title=document.createElement('h3');title.textContent=result.name;card.append(title);
    const pair=document.createElement('div');pair.className='images-preview-pair';
    for(const kind of ['before','after']){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.alt=t(`images.${kind}`);img.src=kind==='before'?files.find(file=>file.id===result.fileId)?.url:URL.createObjectURL(result.blob);if(kind==='after')outputUrls.push(img.src);caption.textContent=t(`images.${kind}`)+' · '+t('images.summary',{width:kind==='before'?result.originalWidth:result.width,height:kind==='before'?result.originalHeight:result.height,size:((kind==='before'?result.originalSize:result.blob.size)/1024).toFixed(1)});figure.append(img,caption);pair.append(figure);}card.append(pair);
    const savings=document.createElement('p'),delta=result.blob.size-result.originalSize;savings.textContent=t(delta===0?'images.unchanged':delta<0?'images.savings':'images.growth',{percent:(Math.abs(delta)/result.originalSize*100).toFixed(1)});card.append(savings);
    if(!result.targetMet){const note=document.createElement('p');note.className='tool-warning';note.textContent=t('images.targetMiss');card.append(note);}
    const button=document.createElement('button');button.textContent=t('images.download');button.onclick=()=>downloadText(result.blob,result.name);card.append(button);$('images-output').append(card);
  });
}
function setBusy(value){processing=value;const actionKey={compress:'images.compressTask',resize:'images.resizeTask',crop:'images.crop',format:'images.formatTask'}[imageTask];$('images-run').textContent=imageTask==='crop'?t(cropDirty?'redesign.cropSaveExport':'redesign.cropExportBatch',{count:files.length,cropped:files.filter(file=>file.crop).length}):t('ux.imagesRun',{action:t(actionKey),count:files.length});$('images-run').classList.toggle('primary',!results.length&&files.length>0);$('images-run').disabled=value||importing||!files.length;$('images-cancel').disabled=!value&&!importing;if(importing)setStatus('images.importing');renderCropState();}
function renderCropState(){const state=$('images-crop-state');if(state){state.hidden=!selected;state.textContent=selected?t(cropDirty?'redesign.cropDirty':selected.crop?'redesign.cropSaved':'redesign.cropOriginal',{name:selected.name}):'';}}
function cancelImport(){importGeneration++;importing=false;}
const runner=taskRunner(()=>new Worker(new URL('./tools/images/worker.js',import.meta.url),{type:'module'}),{timeoutMs:120000,onState:state=>setBusy(state.status==='pending'),onEvent:event=>setStatus('images.progress',event),onResult:state=>{results=state.result.results;processFailures=state.result.failures||[];resultFailedCount=processFailures.length+importFailures.length;renderQueue();renderResults();setStatus('images.batchDone',{success:results.length,failed:processFailures.length+importFailures.length});}});
function invalidate(){generation++;runner.invalidate();processFailures=[];releaseResults();renderQueue();}
function closeCrop(){cropGeneration++;cropper?.destroy();cropper=undefined;selected=undefined;cropDirty=false;$('images-crop-container').replaceChildren();$('images-crop-panel').hidden=true;renderCropState();}
async function openCrop(file,focus=false){
  closeCrop();selected=file;const cropToken=++cropGeneration;$('images-crop-panel').hidden=false;$('images-crop-name').textContent=file.name;renderQueue();
  const img=document.createElement('img');img.src=file.url;img.alt=file.name;$('images-crop-container').append(img);
  try {await img.decode();if(selected!==file||cropToken!==cropGeneration)return;cropper=new Cropper(img,{container:$('images-crop-container')});await cropper.getCropperImage().$ready();if(selected!==file||cropToken!==cropGeneration)return;cropper.getCropperImage().$center('contain');const selection=cropper.getCropperSelection();selection.$reset();$('images-ratio').value='0';cropDirty=false;setBusy(processing);const markCropChanged=()=>{cropDirty=true;invalidate();};selection.addEventListener('change',markCropChanged);cropper.getCropperImage().addEventListener('transform',markCropChanged);
    selection.tabIndex=0;selection.setAttribute('role','group');selection.setAttribute('aria-label',t('images.crop'));selection.setAttribute('aria-describedby','images-crop-keys');
    selection.addEventListener('keydown',event=>{
      if(event.target!==selection||event.ctrlKey||event.metaKey||event.altKey)return;
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;
      event.preventDefault();event.stopPropagation();if(event.shiftKey)selection.$resize(delta[0]?'e-resize':'s-resize',...delta);else selection.$move(...delta);
    });
    if(focus){selection.focus({preventScroll:true});selection.scrollIntoView({block:'center'});}
  }
  catch(error){if(selected===file&&cropToken===cropGeneration)showError(mediaError('images.failed'));}
}
async function applyCrop(){
  const file=selected,token=generation;if(!cropper||!file)throw mediaError('images.cropRequired');
  const selection=cropper.getCropperSelection(),matrix=cropper.getCropperImage().$getTransform(),scale=Math.hypot(matrix[0],matrix[1]);
  const width=Math.round(selection.width/scale),height=Math.round(selection.height/scale);if(!width||!height)throw mediaError('images.cropEmpty');checkDimensions(width,height);
  const canvas=await selection.$toCanvas({width,height});const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(mediaError('images.failed')),'image/png'));
  if(token!==generation||selected!==file)return false;if(blob.size>50*1024*1024||files.reduce((n,f)=>n+(f===file?blob:f.crop||f.blob).size,0)>100*1024*1024)throw mediaError('images.limit');invalidate();file.crop=blob;cropDirty=false;renderQueue();setStatus('images.cropSaved',{name:file.name});return true;
}
async function addFiles(incoming){
  if(importing){setStatus('images.importing');return;}
  const list=Array.from(incoming);if(!list.length)return;
  const total=[...files.map(f=>f.blob),...list].reduce((n,f)=>n+f.size,0);
  if(files.length+list.length>30||total>100*1024*1024){showError(mediaError('images.limit'));return;}
  const token=++importGeneration;let accepted=0;importing=true;importFailures=[];setBusy(processing);
  try {
    for(const blob of list){
      try{
        if(blob.size>50*1024*1024)throw mediaError('images.limit');
        const bytes=await blob.arrayBuffer();if(token!==importGeneration)return;
        const header=imageHeader(new Uint8Array(bytes));const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image'});
        let width,height;try{width=bitmap.width;height=bitmap.height;checkDimensions(width,height);}finally{bitmap.close();}
        if(token!==importGeneration)return;
        if(!accepted)invalidate();accepted++;
        files.push({id:++nextFileId,name:blob.name,blob,type:header.type,width,height,url:URL.createObjectURL(blob)});
      }catch(error){if(token!==importGeneration)return;importFailures.push({name:blob.name,code:typeof error.code==='string'?error.code:'images.failed',params:error.params});}
      renderQueue();
    }
    if(token!==importGeneration)return;
    if(importFailures.length)setStatus('images.batchDone',{success:accepted,failed:importFailures.length});else clearStatus();
    if(accepted&&imageTask==='crop'&&!selected&&files.length)await openCrop(files[0]);
  }finally{if(token===importGeneration){importing=false;setBusy(processing);}}
}

function settings(){
  let invalid;for(const field of $('images-settings').querySelectorAll('input[type=number]')){const valid=field.closest('label').hidden||field.disabled||field.checkValidity();field.setAttribute('aria-invalid',String(!valid));if(!valid)invalid=field;}if(invalid)throw mediaError('images.invalidSettings');
  const options={width:Number($('images-width').value),height:Number($('images-height').value),scale:Number($('images-scale').value),quality:$('images-quality').disabled?80:Number($('images-quality').value),target:Number($('images-target').value),aspect:$('images-aspect').checked,allowReduce:$('images-reduce').checked,format:$('images-format').value};
  if(imageTask!=='resize')Object.assign(options,{width:0,height:0,scale:100});
  if(imageTask!=='compress'||$('images-compression-mode').value==='quality')Object.assign(options,{target:0,allowReduce:false});
  if(!Number.isFinite(options.quality)||options.quality<1||options.quality>100||!Number.isFinite(options.target)||options.target<0||options.target>102400||!Number.isInteger(options.width)||options.width<0||!Number.isInteger(options.height)||options.height<0||!Number.isFinite(options.scale)||options.scale<1||options.scale>400)throw mediaError('images.invalidSettings');return options;
}
$('images-files').onchange=event=>{addFiles(event.target.files);event.target.value='';};$('images-drop').ondragover=event=>event.preventDefault();$('images-drop').ondrop=event=>{event.preventDefault();addFiles(event.dataTransfer.files);};
$('images-clear').onclick=()=>{cancelImport();invalidate();closeCrop();for(const file of files)URL.revokeObjectURL(file.url);files=[];importFailures=[];renderQueue();clearStatus();};
$('images-settings').addEventListener('input',event=>{if(event.target.matches('input,select')){invalidate();updateQuality();}});
$('images-ratio').onchange=()=>{invalidate();if(cropper){const selection=cropper.getCropperSelection();selection.aspectRatio=Number($('images-ratio').value)||NaN;selection.$change(selection.x,selection.y,selection.width,selection.height,selection.aspectRatio);}};
for(const [id,action] of [['images-rotate',image=>image.$rotate('90deg')],['images-flip-h',image=>image.$scale(-1,1)],['images-flip-v',image=>image.$scale(1,-1)]])$(id).onclick=()=>{invalidate();if(cropper){action(cropper.getCropperImage());cropDirty=true;setBusy(processing);}};
$('images-apply').onclick=()=>{const token=generation;setBusy(true);applyCrop().catch(error=>{if(token===generation)showError(error);}).finally(()=>{if(token===generation)setBusy(false);});};$('images-reset').onclick=()=>{if(selected){invalidate();selected.crop=undefined;renderQueue();openCrop(selected);}};
$('images-run').onclick=async()=>{
  if(cropper&&cropDirty){const token=generation;setBusy(true);try{if(!(await applyCrop()))return;}catch(error){if(token===generation){setBusy(false);showError(error);}return;}}
  try{invalidate();if(!files.length)throw mediaError('images.noFiles');const options=settings();renderQueue();runner.process({input:files.map(file=>({fileId:file.id,blob:file.crop||file.blob,name:file.name,type:file.type,originalSize:file.blob.size,originalWidth:file.width,originalHeight:file.height})),options});}catch(error){showError(error);}
};
$('images-cancel').onclick=()=>{cancelImport();generation++;runner.cancel();setBusy(false);setStatus('images.cancelled');};
$('images-zip').onclick=async()=>{const token=generation;try{const entries={};for(const result of results){entries[result.name]=new Uint8Array(await result.blob.arrayBuffer());if(token!==generation)return;}if(!Object.keys(entries).length)return;const bytes=zipSync(entries,{level:0});if(bytes.length>100*1024*1024)throw mediaError('images.limit');downloadText(new Blob([bytes],{type:'application/zip'}),'images.zip');}catch(error){if(token===generation)showError(typeof error.code==='string'?error:mediaError('images.failed'));}};
onLanguageChange(()=>{renderQueue();renderResults();translateDOM($('tool-root'));});
addEventListener('pagehide',event=>{cancelImport();generation++;setBusy(false);if(!event.persisted){closeCrop();for(const file of files)URL.revokeObjectURL(file.url);for(const url of outputUrls)URL.revokeObjectURL(url);}});
addEventListener('pageshow',event=>{if(event.persisted){setBusy(false);if(selected&&!cropper)void openCrop(selected);}});
renderQueue();setBusy(false);

const imageAdvanced=document.createElement('details');imageAdvanced.id='images-advanced';imageAdvanced.innerHTML='<summary data-i18n="ux.advanced"></summary><div class="tool-fields"></div>';
$('images-settings').querySelector('.tool-fields').after(imageAdvanced);
for(const id of ['images-width','images-height','images-scale','images-target'])imageAdvanced.querySelector('.tool-fields').append($(id).closest('label'));
for(const id of ['images-aspect','images-reduce'])imageAdvanced.append($(id).closest('label'));
const settingIds=['width','height','scale','quality','target','aspect','reduce','format'],taskSettings=new Map();
const readSettings=()=>({...Object.fromEntries(settingIds.map(id=>[id,$(`images-${id}`).type==='checkbox'?$(`images-${id}`).checked:$(`images-${id}`).value])),compressionMethod:$('images-compression-mode')?.value||'quality'});
const initialSettings=readSettings();
function showSettings(){
 const title=$('images-settings').querySelector(':scope > h2');title.dataset.i18n={compress:'images.compressTask',resize:'images.resizeTask',crop:'images.crop',format:'images.formatTask'}[imageTask];title.textContent=t(title.dataset.i18n);updateQuality();
 for(const id of ['width','height','scale','aspect'])$(`images-${id}`).closest('label').hidden=imageTask!=='resize';
}
const compressionSettings=document.createElement('div');compressionSettings.className='compression-settings';imageAdvanced.before(compressionSettings);compressionSettings.append($('images-target').closest('label'),$('images-reduce').closest('label'));
showSettings();
function chooseImageTask(task,file=files[0]){if(task===imageTask&&task==='crop'&&file===selected)return;taskSettings.set(imageTask,readSettings());imageTask=task;const values=taskSettings.get(task)||initialSettings;for(const id of settingIds){const field=$(`images-${id}`);if(field.type==='checkbox')field.checked=values[id];else field.value=values[id];}if($('images-compression-mode'))$('images-compression-mode').value=values.compressionMethod||'quality';invalidate();closeCrop();showSettings();imageAdvanced.open=task==='resize';if(task==='crop'&&file)void openCrop(file,true);if(task==='resize')$('images-width').focus();if(task==='format')$('images-format').focus();}
const imageGuide=addTaskGuide('images',[{id:'compress',key:'refinement.shortCompress'},{id:'resize',key:'refinement.shortResize'},{id:'crop',key:'refinement.shortCrop'},{id:'format',key:'refinement.shortFormat'}],{
 hasContent:()=>importing||files.length>0||results.length>0,
 beforeChoose:task=>task===imageTask||!cropDirty||confirm(t('direct.files.discardCrop')),
 choose:task=>{if(task!==imageTask)chooseImageTask(task);},
 async example(task){
  cancelImport();invalidate();const token=generation,canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;const context=canvas.getContext('2d');const gradient=context.createLinearGradient(0,0,1200,800);gradient.addColorStop(0,'#0d74ce');gradient.addColorStop(1,'#b9e2ff');context.fillStyle=gradient;context.fillRect(0,0,1200,800);context.fillStyle='#fff';context.fillRect(160,160,880,480);context.fillStyle='#0d74ce';context.font='bold 100px sans-serif';context.fillText('LisTools',390,440);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==generation)return;
  closeCrop();for(const file of files)URL.revokeObjectURL(file.url);files=[];importFailures=[];
  $('images-width').value=task==='resize'?'800':'0';$('images-height').value='0';$('images-scale').value='100';$('images-target').value='0';$('images-quality').value='80';$('images-format').value=task==='format'?'image/webp':'image/jpeg';$('images-reduce').checked=false;$('images-compression-mode').value='quality';
  const file=new File([blob],'sample.png',{type:'image/png'});await addFiles([file]);if(files[0]?.blob!==file)return;
  if(task!=='crop')await $('images-run').onclick();
 }
});
translateDOM(imageAdvanced);

function updateQuality(){
 let note=$('images-quality-note');if(!note){note=document.createElement('p');note.id='images-quality-note';note.className='tool-note';$('images-quality').closest('label').after(note);}
 const format=$('images-format').value,eligible=format==='original'?files.some(file=>['image/jpeg','image/webp'].includes(file.type)):['image/jpeg','image/webp'].includes(format);
 $('images-quality').disabled=!eligible;note.textContent=t('images.pngQuality');note.hidden=eligible&&format!=='original';syncCompressionMode();const warning=$('images-jpeg-warning');if(warning)warning.hidden=format!=='image/jpeg';
}

$('images-run').removeAttribute('data-i18n');const imageActions=mediaWorkspace('images',{resultTarget:'#images-results',hasResult:()=>results.length>0});compressionSettings.after($('images-run-reason'),imageActions);const jpegNote=document.querySelector('[data-i18n="images.jpegNotice"]');$('images-drop').querySelector('details').append(jpegNote);
document.querySelector('.workspace-input').prepend($('images-crop-panel'));
const cropKeys=document.createElement('p');cropKeys.id='images-crop-keys';cropKeys.className='tool-note';cropKeys.dataset.i18n='images.cropKeys';$('images-crop-container').before(cropKeys);
const translateCrop=()=>{cropKeys.textContent=t('images.cropKeys');cropper?.getCropperSelection()?.setAttribute('aria-label',t('images.crop'));};onLanguageChange(translateCrop);translateCrop();

const cropScope=document.createElement('p');cropScope.className='tool-note';cropScope.dataset.i18n='ux.cropCurrent';cropScope.textContent=t('ux.cropCurrent');$('images-crop-container').before(cropScope);

const compressionMode=document.createElement('label');compressionMode.className='field';compressionMode.id='images-compression-field';compressionMode.innerHTML='<span data-i18n="refinement.compressMode"></span><select id="images-compression-mode"><option value="quality" data-i18n="refinement.byQuality"></option><option value="target" data-i18n="refinement.byTarget"></option></select>';compressionSettings.prepend(compressionMode);
$('images-target').previousElementSibling.dataset.i18n='refinement.targetSize';$('images-apply').dataset.i18n='redesign.cropSaveCurrent';
const cropNote=$('images-crop-panel').querySelector('[data-i18n="images.cropNote"]');cropNote.dataset.i18n='redesign.cropNote';
const cropState=document.createElement('p');cropState.id='images-crop-state';cropState.className='tool-note';cropState.setAttribute('aria-live','polite');$('images-crop-name').after(cropState);renderCropState();
let lastTarget=256;
function syncCompressionMode(){const picker=$('images-compression-mode');if(!picker)return;const target=picker.value==='target';$('images-target').min=target?'1':'0';$('images-target').required=target;compressionMode.hidden=imageTask!=='compress';$('images-target').closest('label').hidden=imageTask!=='compress'||!target;$('images-reduce').closest('label').hidden=imageTask!=='compress'||!target;}
$('images-compression-mode').oninput=event=>{event.stopPropagation();if($('images-compression-mode').value==='quality'){lastTarget=Number($('images-target').value)||lastTarget;$('images-target').value='0';}else $('images-target').value=String(lastTarget);invalidate();updateQuality();};
const jpegWarning=document.createElement('p');jpegWarning.id='images-jpeg-warning';jpegWarning.className='tool-warning';jpegWarning.dataset.i18n='refinement.jpegWhite';$('images-format').closest('label').after(jpegWarning);
const imageSummary=document.createElement('section');imageSummary.id='images-result-summary';imageSummary.className='media-inline-result';imageSummary.hidden=true;imageSummary.innerHTML='<h2 data-i18n="images.results"></h2><p id="images-result-info"></p><p id="images-result-metrics" class="tool-note"></p><div class="tool-actions"><button id="images-download" class="primary" data-i18n="images.download"></button><button id="images-view-result" data-i18n="refinement.viewResult"></button></div>';$('images-settings').prepend(imageSummary);imageSummary.querySelector('.tool-actions').append($('images-zip'));
$('images-download').onclick=()=>{if(results[0])downloadText(results[0].blob,results[0].name);};$('images-view-result').onclick=()=>{$('images-results').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});$('images-results').tabIndex=-1;$('images-results').focus({preventScroll:true});};
function renderResultSummary(){const summary=$('images-result-summary');if(!summary)return;summary.hidden=!results.length;$('images-result-info').textContent=t('images.batchDone',{success:results.length,failed:resultFailedCount});const before=results.reduce((total,item)=>total+item.originalSize,0),after=results.reduce((total,item)=>total+item.blob.size,0);$('images-result-metrics').textContent=results.length?`${t('images.before')}: ${(before/1024).toFixed(1)} KiB → ${t('images.after')}: ${(after/1024).toFixed(1)} KiB${results.some(item=>!item.targetMet)?' · '+t('images.targetMiss'):''}`:'';$('images-download').hidden=results.length!==1;$('images-zip').classList.toggle('primary',results.length>1);$('images-run').classList.toggle('primary',!results.length&&files.length>0);}
void sortableQueue($('images-queue'),(from,to)=>{invalidate();files.splice(to,0,files.splice(from,1)[0]);renderQueue();});
onLanguageChange(()=>{syncCompressionMode();renderResultSummary();});translateDOM($('images-settings'));translateDOM($('images-crop-panel'));syncCompressionMode();updateQuality();

const queueWidth=matchMedia('(max-width:760px)');queueWidth.addEventListener('change',()=>{for(const details of $('images-queue').querySelectorAll('.media-file-actions'))details.open=!queueWidth.matches;});
