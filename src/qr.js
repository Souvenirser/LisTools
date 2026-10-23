import {actionArea} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import { initTool, showError, clearStatus, taskRunner, setStatus } from './tools/shared/office.js';
import { copyText, downloadText } from './tools/shared/page.js';
import { generateQr } from './tools/qr/core.js';
const $=id=>document.getElementById(id);
initTool('qr',`<div class="tool-grid"><section class="tool-card"><h2 data-i18n="common.input"></h2><label for="qr-input" data-i18n="qr.content"></label><textarea id="qr-input" rows="5" spellcheck="false"></textarea><div class="tool-fields"><div class="field"><label for="qr-size" data-i18n="qr.size"></label><input id="qr-size" type="number" min="128" max="2048" step="1" value="320"></div><div class="field"><label for="qr-level" data-i18n="qr.level"></label><select id="qr-level">${['L','M','Q','H'].map(level=>`<option value="${level}"${level==='M'?' selected':''}>${level}</option>`).join('')}</select></div></div><p class="tool-note" data-i18n="qr.marginHelp"></p><div class="tool-actions"><button id="qr-generate" class="primary" data-i18n="ux.qrGenerate"></button><button id="qr-png" data-i18n="qr.png" disabled></button><button id="qr-svg" data-i18n="qr.svg" disabled></button></div><canvas id="qr-canvas" hidden style="max-width:100%;height:auto" data-i18n-aria-label="qr.preview"></canvas></section><section class="tool-card"><h2 data-i18n="ux.chooseImages"></h2><label for="qr-file" class="tool-note" data-i18n="qr.imageHelp"></label><input id="qr-file" type="file" accept="image/png,image/jpeg,image/webp"><div id="qr-drop" class="tool-card" tabindex="0" data-i18n="qr.drop"></div><p class="tool-note" data-i18n="qr.localHelp"></p><label for="qr-result" data-i18n="qr.result"></label><textarea id="qr-result" rows="5" readonly></textarea><div class="tool-actions"><button id="qr-copy" data-i18n="common.copy" disabled></button><button id="qr-cancel" data-i18n="common.cancel"></button></div></section></div>`);
let svg='',generation=0,decodeGeneration=0,sourceUrl,decoding=false,recognizing=false;
function qrBusy(){ $('qr-cancel').disabled=!(decoding||recognizing);$('qr-cancel').hidden=!(decoding||recognizing); }
function clearGenerated(){const had=Boolean(svg);generation++;svg='';if(had)setStatus('ux.stale');$('qr-canvas').hidden=true;refreshQrEmpty();$('qr-png').disabled=$('qr-svg').disabled=true;}
for(const id of ['input','size','level'])$(`qr-${id}`).addEventListener('input',clearGenerated);
$('qr-generate').onclick=async()=>{clearGenerated();clearStatus();const token=generation;try{const result=await generateQr($('qr-input').value,{size:Number($('qr-size').value),level:$('qr-level').value});if(token!==generation)return;svg=result.svg;const canvas=$('qr-canvas');canvas.width=canvas.height=result.size;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,result.size,result.size);context.fillStyle='#000';const unit=result.size/(result.modules.size+8);for(let y=0;y<result.modules.size;y++)for(let x=0;x<result.modules.size;x++)if(result.modules.data[y*result.modules.size+x]){const left=Math.round((x+4)*unit),top=Math.round((y+4)*unit);context.fillRect(left,top,Math.round((x+5)*unit)-left,Math.round((y+5)*unit)-top);}canvas.hidden=false;$('tool-status').dataset.taskState='ready';$('qr-png').disabled=$('qr-svg').disabled=false;refreshQrEmpty();}catch(error){if(token===generation)showError(error);}};
$('qr-png').onclick=()=>{$('qr-canvas').toBlob(blob=>{if(blob)downloadText(blob,'qrcode.png');},'image/png');};$('qr-svg').onclick=()=>downloadText(svg,'qrcode.svg','image/svg+xml');
const runner=taskRunner(()=>new Worker(new URL('./tools/qr/worker.js',import.meta.url),{type:'module'}),{onState(state){recognizing=state.status==='pending';qrBusy();},onResult(result){$('qr-result').value=result.text;$('qr-copy').disabled=false;refreshQrEmpty();},timeoutMs:30000});
async function recognize(file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return showError({code:'qr.imageType'});
 if(file.size>20*1024**2)return showError({code:'qr.imageLimit'});
 let token=++decodeGeneration;runner.invalidate();decoding=true;setStatus('common.processing');qrBusy();let bitmap,canvas;
 try{
  bitmap=await createImageBitmap(file);if(token!==decodeGeneration)return;
  if(bitmap.width*bitmap.height>16*1024**2)throw {code:'qr.pixelLimit'};
  canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0);const image=context.getImageData(0,0,canvas.width,canvas.height);
  setQrMode('recognize');token=decodeGeneration;decoding=true;
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);sourceUrl=URL.createObjectURL(file);$('qr-source-image').src=sourceUrl;$('qr-source-image').hidden=false;$('qr-result').value='';$('qr-copy').disabled=true;
  runner.process({pixels:image.data,width:canvas.width,height:canvas.height});
 }catch(error){if(token===decodeGeneration)showError(error.code?error:{code:'qr.decodeError'});}
 finally{if(token===decodeGeneration){decoding=false;qrBusy();}bitmap?.close();if(canvas)canvas.width=canvas.height=0;}
}
$('qr-file').onchange=()=>{void recognize($('qr-file').files[0]);$('qr-file').value='';};$('qr-drop').ondragover=event=>event.preventDefault();$('qr-drop').ondrop=event=>{event.preventDefault();void recognize(event.dataTransfer.files[0]);};
document.addEventListener('paste',event=>{const file=[...event.clipboardData.items].find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();void recognize(file);}});
$('qr-cancel').onclick=()=>{decodeGeneration++;decoding=false;runner.cancel();qrBusy();};$('qr-copy').onclick=()=>copyText($('qr-result').value);
addEventListener('pagehide',event=>{decodeGeneration++;generation++;decoding=false;qrBusy();if(!event.persisted){clearGenerated();if(sourceUrl)URL.revokeObjectURL(sourceUrl);}});

const qrPanels=document.querySelectorAll('#tool-root .tool-grid>.tool-card');
const qrAdvanced=document.createElement('details');qrAdvanced.innerHTML='<summary data-i18n="office.advanced"></summary>';
const qrFields=$('qr-size').closest('.tool-fields');qrFields.before(qrAdvanced);qrAdvanced.append(qrFields);
qrAdvanced.append(document.querySelector('[data-i18n="qr.marginHelp"]'));qrPanels[0].parentElement.style.gridTemplateColumns='minmax(0,1fr)';
const sourceImage=document.createElement('img');sourceImage.id='qr-source-image';sourceImage.hidden=true;sourceImage.alt='';sourceImage.style.maxWidth='240px';$('qr-drop').after(sourceImage);
function setQrMode(mode){generation++;decodeGeneration++;decoding=false;runner.invalidate();qrPanels[0].hidden=mode!=='generate';qrPanels[1].hidden=mode!=='recognize';qrGuide.select(mode);syncQrOutput(mode);}
const qrGuide=addTaskGuide('qr',[{id:'generate',key:'ux.qrGenerate'},{id:'recognize',key:'ux.qrRecognize'}],{
 hasContent:()=>Boolean($('qr-input').value||svg||sourceUrl||$('qr-result').value||decoding||recognizing),
 choose:setQrMode,
 async example(mode){
  const decodeToken=decodeGeneration;$('qr-input').value='https://example.com';
  const pending=$('qr-generate').onclick(),token=generation;await pending;
  if(token!==generation||decodeToken!==decodeGeneration)return;
  if(mode==='recognize'){const blob=await new Promise(resolve=>$('qr-canvas').toBlob(resolve,'image/png'));if(token===generation&&decodeToken===decodeGeneration)await recognize(blob);}
 }
});
setQrMode('generate');translateDOM(qrAdvanced);

const qrGrid=qrPanels[0].parentElement;qrGrid.style.removeProperty('grid-template-columns');
const qrInputColumn=document.createElement('div');qrGrid.prepend(qrInputColumn);qrInputColumn.append(...qrPanels);
const qrOutput=document.createElement('section');qrOutput.className='tool-card';qrOutput.id='qr-output-panel';qrOutput.innerHTML='<h2 data-i18n="common.result"></h2>';qrGrid.append(qrOutput);
qrOutput.append($('qr-canvas'),document.querySelector('label[for="qr-result"]'),$('qr-result'));
const qrActions=$('qr-generate').closest('.tool-actions');qrActions.append($('qr-copy'),$('qr-cancel'));qrInputColumn.append(qrActions);actionArea(qrActions);
const qrDownloads=document.createElement('div');qrDownloads.className='tool-actions';qrOutput.append(qrDownloads);qrDownloads.append($('qr-png'),$('qr-svg'),$('qr-copy'));
function syncQrOutput(mode){if(!$('qr-output-panel'))return;const generating=mode==='generate';const title=$('qr-output-panel').querySelector('h2');title.dataset.i18n=generating?'qr.preview':'qr.result';title.textContent=t(title.dataset.i18n);$('qr-canvas').hidden=!generating||!svg;$('qr-result').hidden=generating;document.querySelector('label[for="qr-result"]').hidden=generating;for(const id of ['qr-generate','qr-png','qr-svg'])$(id).hidden=!generating;$('qr-copy').hidden=generating;$('qr-cancel').hidden=generating||!(decoding||recognizing);refreshQrEmpty();}
syncQrOutput('generate');translateDOM(qrOutput);

const qrEmpty=document.createElement('div');qrEmpty.className='result-empty';qrEmpty.id='qr-empty';qrOutput.insertBefore(qrEmpty,$('qr-canvas'));
function refreshQrEmpty(){const empty=$('qr-empty');if(!empty)return;const generating=$('qr-task-generate').getAttribute('aria-pressed')==='true';empty.hidden=generating?Boolean(svg):Boolean($('qr-result').value);empty.textContent=t(generating?'qr.empty':'qr.drop');const meta=$('qr-output-meta');if(meta){meta.hidden=!generating||!svg;meta.textContent=svg?t('refinement.qrInfo',{size:$('qr-canvas').width,level:$('qr-level').value}):'';}}
function qrSettings(){qrAdvanced.querySelector('summary').textContent=`${t('ux.qrSettings')}: ${$('qr-size').value} · ${t('qr.level')}: ${$('qr-level').value}`;refreshQrEmpty();}
for(const id of ['qr-size','qr-level'])$(id).addEventListener('input',qrSettings);onLanguageChange(qrSettings);qrSettings();

qrAdvanced.before(document.querySelector('.workspace-action-area'));

const qrMeta=document.createElement('p');qrMeta.id='qr-output-meta';qrMeta.className='tool-note';$('qr-canvas').before(qrMeta);refreshQrEmpty();
