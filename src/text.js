import {actionArea} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import { initTool, showError, setStatus, clearStatus, taskRunner } from './tools/shared/office.js';
import { copyText, downloadText } from './tools/shared/page.js';
import { t, language, onLanguageChange, translateDOM } from './i18n.js';
const $=id=>document.getElementById(id);
const option=(value,key)=>`<option value="${value}" data-i18n="text.${key}"></option>`;
initTool('text',`<div class="tool-grid"><section class="tool-card"><h2 data-i18n="text.input"></h2><label for="text-input" class="tool-note" data-i18n="text.inputHelp"></label><textarea id="text-input" rows="13" spellcheck="false"></textarea><div class="tool-actions"><button id="text-import" type="button" data-i18n="text.import"></button><input id="text-file" type="file" accept=".txt,text/plain" hidden><button id="text-count" data-i18n="text.count"></button><button id="text-clear" data-i18n="common.clear"></button></div><p id="text-counts" class="tool-note" aria-live="polite"></p></section><section class="tool-card"><h2 data-i18n="text.result"></h2><textarea id="text-result" rows="13" readonly data-i18n-aria-label="text.result"></textarea><p id="text-result-note" class="tool-note"></p><div class="tool-actions"><button id="text-copy" data-i18n="common.copy" disabled></button><button id="text-download" data-i18n="text.download" disabled></button><button id="text-use" data-i18n="uiText.useResult" disabled></button></div></section></div><section class="tool-card"><h2 data-i18n="text.operations"></h2><div class="tool-fields"><div class="field"><label for="text-operation" data-i18n="text.operation"></label><select id="text-operation">${option('lines','lines')}${option('case','case')}${option('newline','newline')}${option('replace','replace')}${option('extract','extract')}${option('mask','mask')}</select></div><div class="field" data-options="lines"><label for="text-lines" data-i18n="text.linesOperation"></label><select id="text-lines">${option('dedupe','dedupe')}${option('sort','sort')}${option('remove-empty','removeBlank')}${option('trim','trim')}</select></div><div class="field" data-options="case" hidden><label for="text-case" data-i18n="text.case"></label><select id="text-case">${['upper','lower','camel','pascal','snake','kebab','constant'].map(value=>option(value,value)).join('')}</select></div><div class="field" data-options="newline" hidden><label for="text-newline" data-i18n="text.newline"></label><select id="text-newline">${['lf','crlf','cr'].map(value=>option(value,value)).join('')}</select></div></div><div data-options="replace" hidden><div class="tool-fields"><div class="field"><label for="text-find" data-i18n="text.find"></label><input id="text-find"></div><div class="field"><label for="text-replacement" data-i18n="text.replacement"></label><input id="text-replacement"></div></div><p class="tool-note" data-i18n="text.literalHelp"></p></div><div data-options="extract" hidden><label for="text-kind" data-i18n="text.kind"></label><select id="text-kind">${['email','phone','url'].map(value=>option(value,value)).join('')}</select><label class="check-label"><input id="text-dedupe" type="checkbox" checked><span data-i18n="text.dedupe"></span></label><p class="tool-note" data-i18n="text.extractHelp"></p></div><div data-options="mask" hidden>${['phone','email','id'].map(kind=>`<label class="check-label"><input id="text-mask-${kind}" type="checkbox" checked><span data-i18n="text.${kind}"></span></label>`).join('')}<p class="tool-note" data-i18n="text.maskHelp"></p></div><div class="tool-actions"><button id="text-run" class="primary" data-i18n="text.apply"></button><button id="text-cancel" data-i18n="common.cancel"></button></div></section>`);
let stale=false,result,counts,countOnly=false,importGeneration=0,importing=false,processing=false,countTimer,composingText=false,explicitRun=false,applyingRoute=false;
function importState(){$('text-run').disabled=importing||processing;$('text-run').setAttribute('aria-busy',String(processing));$('text-count').disabled=importing;$('text-cancel').disabled=!importing&&!processing;if(importing)setStatus('text.importing');}
function renderCounts(){
 const summary=$('text-operation-summary');
 if(summary){
  const v=result?.summary,empty=result?.outputBytes===0;summary.hidden=false;summary.dataset.state=result?(empty?'empty':'success'):stale?'stale':'idle';
  summary.textContent=!result?t(stale?'redesign.textStale':'redesign.textIdle'):empty?t($('text-operation').value==='extract'?'experience.no'+$('text-kind').value:'redesign.textEmpty'):$('text-operation').value==='newline'?t('redesign.textNewlineSummary',{format:$('text-newline').value.toUpperCase(),bytes:result.outputBytes}):v?.inputLines!==undefined?t('ux.lineSummary',{before:v.inputLines,after:v.outputLines}):v?.items!==undefined?t('ux.extractSummary',{matches:v.matches,count:v.items}):v?.replacements!==undefined?t('ux.replaceSummary',{count:v.replacements}):$('text-operation').value==='mask'?t('ux.maskSummary',{count:v?.masked||0}):t('ux.processed');
  if(result&&empty&&$('text-operation').value==='newline')summary.textContent+=' '+t('redesign.textNewlineSummary',{format:$('text-newline').value.toUpperCase(),bytes:result.outputBytes});
 }
 $('text-counts').textContent=counts?t('redesign.textInputStats',{summary:t('refinement.textCountSummary',counts)}):'';
 const output=$('text-output-counts');if(output){output.hidden=!result;output.textContent=result?t('redesign.textOutputBytes',{bytes:result.outputBytes}):'';}
 $('text-result-note').textContent=result&&(result.previewTruncated||result.truncated)?t(result.truncated?'text.matchTruncated':'text.previewTruncated'):'';
 const reuseReason=$('text-use-reason');if(reuseReason){const limited=Boolean(result&&result.outputBytes>10*1024**2);reuseReason.hidden=!limited;reuseReason.textContent=t('polish.files.reuseLimit');$('text-use').disabled=!result||limited;if(limited)$('text-use').setAttribute('aria-describedby',reuseReason.id);else $('text-use').removeAttribute('aria-describedby');}
}
function resetResult(){stale=stale||Boolean(result);result=undefined;$('text-result').value='';for(const id of ['copy','download','use'])$(`text-${id}`).disabled=true;renderCounts();}
const runner=taskRunner(()=>new Worker(new URL('./tools/text/worker.js',import.meta.url),{type:'module'}),{onState(state){processing=state.status==='pending';importState();if(state.status==='error'&&state.code==='text.emptyFind')showError(state,{field:'text-find',focus:explicitRun});if(state.status==='ready'&&countOnly&&stale)setStatus('ux.stale');},onResult(value){counts=value.counts;if(!countOnly){stale=false;result=value;$('text-result').value=value.preview;for(const id of ['copy','download','use'])$(`text-${id}`).disabled=false;}renderCounts();},timeoutMs:60000});
function run(operation=$('text-operation').value){clearTimeout(countTimer);countOnly=operation==='count';const request={input:$('text-input').value,operation,locale:language(),style:$('text-case').value,ending:$('text-newline').value,find:$('text-find').value,replacement:$('text-replacement').value,kind:$('text-kind').value,dedupe:$('text-dedupe').checked,phone:$('text-mask-phone').checked,email:$('text-mask-email').checked,id:$('text-mask-id').checked};if(operation==='lines')request.operation='lines',request.lineOperation=$('text-lines').value;runner.process(request);}
$('text-run').onclick=()=>{explicitRun=true;run();};$('text-count').onclick=()=>{explicitRun=false;run('count');};$('text-cancel').onclick=()=>{clearTimeout(countTimer);importGeneration++;importing=false;runner.cancel();};
$('text-input').oninput=()=>{explicitRun=false;importGeneration++;importing=false;runner.invalidate();resetResult();counts=undefined;renderCounts();clearTimeout(countTimer);countTimer=setTimeout(()=>{if(!composingText)run($('text-input').value&&new TextEncoder().encode($('text-input').value).length<=256*1024?$('text-operation').value:'count');},350);$('text-cancel').disabled=false;};
$('text-operation').onchange=()=>{runner.invalidate();for(const element of document.querySelectorAll('[data-options]'))element.hidden=element.dataset.options!==$('text-operation').value;};
for(const element of $('tool-root').querySelectorAll('select,input:not([type=file])'))element.addEventListener('change',()=>{runner.invalidate();resetResult();});
for(const id of ['find','replacement'])$(`text-${id}`).oninput=()=>{runner.invalidate();resetResult();};
$('text-clear').onclick=()=>{$('text-input').value='';$('text-input').oninput();stale=false;renderCounts();clearStatus();};
$('text-copy').onclick=async()=>{if(result)await copyText(await result.blob.text());};
$('text-download').onclick=()=>{if(result)downloadText(result.blob,'text-result.txt');};
$('text-use').onclick=async()=>{if(result){const source=result,generation=importGeneration;$('text-cancel').disabled=false;try{const value=await source.blob.text();if(generation!==importGeneration||result!==source)return;if(new Blob([value]).size>10*1024**2)return showError({code:'text.inputLimit'});$('text-input').value=value;$('text-input').oninput();}finally{if(generation===importGeneration)$('text-cancel').disabled=true;}}};
async function importFile(file){
 if(!file)return;const generation=++importGeneration;importing=false;clearTimeout(countTimer);runner.invalidate();
 if(file.size>10*1024**2)return showError({code:'text.inputLimit'});
 importing=true;importState();
 try{const value=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(generation!==importGeneration)return;$('text-input').value=value;$('text-input').oninput();}
 catch{if(generation===importGeneration)showError({code:'text.invalidText'});}
 finally{if(generation===importGeneration){importing=false;importState();}}
}
$('text-import').onclick=()=>$('text-file').click();
$('text-file').onchange=()=>{void importFile($('text-file').files[0]);$('text-file').value='';};
$('text-input').ondragover=event=>event.preventDefault();$('text-input').ondrop=event=>{event.preventDefault();void importFile(event.dataTransfer.files[0]);};
onLanguageChange(()=>{renderCounts();if(stale&&!processing&&!importing)setStatus('ux.stale');});

addEventListener('pagehide',()=>{clearTimeout(countTimer);importGeneration++;const wasImporting=importing;importing=false;if(wasImporting)setStatus('office.cancelled');importState();});

const textOptions=$('text-run').closest('section');
document.querySelector('#tool-root .tool-grid').before(textOptions);
$('text-operation').closest('.field').hidden=true;
const textActions=$('text-input').parentElement.querySelector('.tool-actions'),textPrimary=document.createElement('div');textPrimary.className='tool-actions';textActions.before(textPrimary);textPrimary.append($('text-run'),$('text-cancel'));
const taskKeys={dedupe:'lines',extract:'extract',replace:'replace',mask:'mask',case:'case',newline:'newline'};
function textAction(){const mode=$('text-operation').value,key=mode==='lines'?{dedupe:'dedupe',sort:'sort','remove-empty':'removeBlank',trim:'trim'}[$('text-lines').value]:mode;$('text-run').textContent=mode==='extract'?t('experience.extract'+{phone:'Phone',email:'Email',url:'Url'}[$('text-kind').value]):t('text.'+key);}
const guide=addTaskGuide('text',Object.entries(taskKeys).map(([id,key])=>({id,key:'ux.'+({dedupe:'textLines',extract:'textExtract',replace:'textReplace',mask:'textMask',case:'textCase',newline:'textNewline'})[id]})),{
 hasContent:()=>Boolean($('text-input').value||$('text-find').value||$('text-replacement').value||result),
 choose(task,{fromRoute=false}={}){applyingRoute=fromRoute;clearTimeout(countTimer);$('text-operation').value=taskKeys[task];$('text-operation').dispatchEvent(new Event('change'));applyingRoute=false;},
 applyPreset(preset){clearTimeout(countTimer);explicitRun=false;$(preset.control).value=preset.value;runner.invalidate();resetResult();describeLines();textAction();},
 example(){const operation=$('text-operation').value;$('text-input').value=operation==='extract'?'Alice alice@example.com, 13812345678\nBob bob@example.com, 13912345678':operation==='replace'?'Hello Acme. Welcome to Acme.':operation==='mask'?'Alice: alice@example.com, 13812345678':'Alice\nBob\nAlice\nCharlie\nBob';if(operation==='replace'){$('text-find').value='Acme';$('text-replacement').value='LisTools';}$('text-input').oninput();run();}
});
$('text-operation').addEventListener('change',()=>{guide.select($('text-operation').value==='lines'?'dedupe':$('text-operation').value);textAction();});
const lineHelp=document.createElement('p');lineHelp.id='text-line-help';lineHelp.className='tool-note';$('text-lines').closest('.field').append(lineHelp);
function describeLines(){const operation=$('text-lines').value;lineHelp.hidden=!['dedupe','sort'].includes(operation);lineHelp.textContent=t(operation==='sort'?'direct.files.lineSortHelp':'direct.files.lineDedupeHelp');}
$('text-lines').addEventListener('change',describeLines);onLanguageChange(describeLines);describeLines();
$('text-lines').addEventListener('change',textAction);$('text-kind').addEventListener('change',textAction);onLanguageChange(textAction);textAction();
$('text-run').removeAttribute('data-i18n');textOptions.querySelector('.tool-actions').remove();
actionArea($('text-run').closest('.tool-actions'),$('tool-status'));$('text-cancel').disabled=true;

textOptions.className='text-task-options';textOptions.querySelector('h2').remove();$('text-input').before(textOptions);

const operationSummary=document.createElement('p');operationSummary.id='text-operation-summary';operationSummary.className='result-conclusion';$('text-result').before(operationSummary);
const outputCounts=document.createElement('p');outputCounts.id='text-output-counts';outputCounts.className='tool-note';$('text-result').after(outputCounts);renderCounts();

const textGrid=document.querySelector('#tool-root>.tool-grid');textGrid.classList.add('editor-workspace');
const textControls=document.createElement('div');textControls.className='text-workspace-controls';textGrid.before(textControls);textControls.append(textOptions,document.querySelector('.workspace-action-area'));

const textNotes=document.createElement('div');textNotes.className='text-parameter-notes';textControls.after(textNotes);
const lineNote=document.createElement('div');lineNote.dataset.options='lines';lineNote.append(lineHelp);textNotes.append(lineNote);
for(const task of ['replace','extract','mask']){const note=textOptions.querySelector(`[data-options="${task}"]>.tool-note`);note.dataset.options=task;note.hidden=$('text-operation').value!==task;textNotes.append(note);}

$('tool-root').addEventListener('compositionstart',()=>{composingText=true;clearTimeout(countTimer);runner.invalidate();});
$('tool-root').addEventListener('compositionend',()=>{composingText=false;$('text-input').oninput();});
function scheduleTextOptions(){if(applyingRoute)return;guide.clearPreset();explicitRun=false;clearTimeout(countTimer);if($('text-operation').value==='replace'&&!$('text-find').value)return;if(!composingText&&$('text-input').value&&new TextEncoder().encode($('text-input').value).length<=256*1024)countTimer=setTimeout(()=>run(),350);}
for(const control of textOptions.querySelectorAll('input,select')){control.addEventListener('change',scheduleTextOptions);if(control.matches('input:not([type=checkbox])'))control.addEventListener('input',scheduleTextOptions);}
const reuseReason=document.createElement('p');reuseReason.id='text-use-reason';reuseReason.className='tool-note';reuseReason.hidden=true;$('text-result-note').after(reuseReason);renderCounts();
for(const card of textGrid.children){const heading=document.createElement('div'),footer=document.createElement('div'),reader=card.querySelector('textarea');heading.className='text-editor-heading';footer.className='text-editor-footer';heading.append(card.querySelector('h2'),card.querySelector('.result-conclusion')||card.querySelector('label'));for(const node of [...card.children])if(node!==reader)footer.append(node);card.append(heading,reader,footer);}
const importHelp=textGrid.querySelector('label[for="text-input"]');textGrid.querySelector('.text-editor-footer').prepend(importHelp);
const autoNote=document.createElement('p');autoNote.className='tool-note text-auto-note';autoNote.dataset.i18n='experience.textAuto';autoNote.textContent=t(autoNote.dataset.i18n);textNotes.append(autoNote);
