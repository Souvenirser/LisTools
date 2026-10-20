import { addTaskGuide } from './tools/shared/task-guide.js';
import { initTool, showError, taskRunner } from './tools/shared/office.js';
import { copyText, downloadText } from './tools/shared/page.js';
import { t, language, onLanguageChange, translateDOM } from './i18n.js';
const $=id=>document.getElementById(id);
const option=(value,key)=>`<option value="${value}" data-i18n="text.${key}"></option>`;
initTool('text',`<div class="tool-grid"><section class="tool-card"><h2 data-i18n="text.input"></h2><label for="text-input" class="tool-note" data-i18n="text.inputHelp"></label><textarea id="text-input" rows="13" spellcheck="false"></textarea><div class="tool-actions"><label class="btn" for="text-file" data-i18n="text.import"></label><input id="text-file" type="file" accept=".txt,text/plain" hidden><button id="text-count" data-i18n="text.count"></button><button id="text-clear" data-i18n="common.clear"></button></div><p id="text-counts" class="tool-note" aria-live="polite"></p></section><section class="tool-card"><h2 data-i18n="text.result"></h2><textarea id="text-result" rows="13" readonly data-i18n-aria-label="text.result"></textarea><p id="text-result-note" class="tool-note"></p><div class="tool-actions"><button id="text-copy" data-i18n="common.copy" disabled></button><button id="text-download" data-i18n="text.download" disabled></button><button id="text-use" data-i18n="text.use" disabled></button></div></section></div><section class="tool-card"><h2 data-i18n="text.operations"></h2><div class="tool-fields"><div class="field"><label for="text-operation" data-i18n="text.operation"></label><select id="text-operation">${option('lines','lines')}${option('case','case')}${option('newline','newline')}${option('replace','replace')}${option('extract','extract')}${option('mask','mask')}</select></div><div class="field" data-options="lines"><label for="text-lines" data-i18n="text.linesOperation"></label><select id="text-lines">${option('dedupe','dedupe')}${option('sort','sort')}${option('remove-empty','removeBlank')}${option('trim','trim')}</select></div><div class="field" data-options="case" hidden><label for="text-case" data-i18n="text.case"></label><select id="text-case">${['upper','lower','camel','pascal','snake','kebab','constant'].map(value=>option(value,value)).join('')}</select></div><div class="field" data-options="newline" hidden><label for="text-newline" data-i18n="text.newline"></label><select id="text-newline">${['lf','crlf','cr'].map(value=>option(value,value)).join('')}</select></div></div><div data-options="replace" hidden><div class="tool-fields"><div class="field"><label for="text-find" data-i18n="text.find"></label><input id="text-find"></div><div class="field"><label for="text-replacement" data-i18n="text.replacement"></label><input id="text-replacement"></div></div><p class="tool-note" data-i18n="text.literalHelp"></p></div><div data-options="extract" hidden><label for="text-kind" data-i18n="text.kind"></label><select id="text-kind">${['email','phone','url'].map(value=>option(value,value)).join('')}</select><label class="check-label"><input id="text-dedupe" type="checkbox" checked><span data-i18n="text.dedupe"></span></label><p class="tool-note" data-i18n="text.extractHelp"></p></div><div data-options="mask" hidden>${['phone','email','id'].map(kind=>`<label class="check-label"><input id="text-mask-${kind}" type="checkbox" checked><span data-i18n="text.${kind}"></span></label>`).join('')}<p class="tool-note" data-i18n="text.maskHelp"></p></div><div class="tool-actions"><button id="text-run" class="primary" data-i18n="text.apply"></button><button id="text-cancel" data-i18n="common.cancel"></button></div></section>`);
let result,counts,countOnly=false,importGeneration=0,countTimer;
function renderCounts(){ $('text-counts').textContent=counts?t('text.countSummary',counts):''; $('text-result-note').textContent=result&&(result.previewTruncated||result.truncated)?t(result.truncated?'text.matchTruncated':'text.previewTruncated'):'';}
function resetResult(){result=undefined;$('text-result').value='';for(const id of ['copy','download','use'])$(`text-${id}`).disabled=true;renderCounts();}
const runner=taskRunner(()=>new Worker(new URL('./tools/text/worker.js',import.meta.url),{type:'module'}),{onResult(value){counts=value.counts;if(!countOnly){result=value;$('text-result').value=value.preview;for(const id of ['copy','download','use'])$(`text-${id}`).disabled=false;}renderCounts();},timeoutMs:60000});
function run(operation=$('text-operation').value){clearTimeout(countTimer);countOnly=operation==='count';const request={input:$('text-input').value,operation,locale:language(),style:$('text-case').value,ending:$('text-newline').value,find:$('text-find').value,replacement:$('text-replacement').value,kind:$('text-kind').value,dedupe:$('text-dedupe').checked,phone:$('text-mask-phone').checked,email:$('text-mask-email').checked,id:$('text-mask-id').checked};if(operation==='lines')request.operation='lines',request.lineOperation=$('text-lines').value;runner.process(request);}
$('text-run').onclick=()=>run();$('text-count').onclick=()=>run('count');$('text-cancel').onclick=()=>{clearTimeout(countTimer);importGeneration++;runner.cancel();};
$('text-input').oninput=()=>{importGeneration++;runner.invalidate();resetResult();counts=undefined;renderCounts();clearTimeout(countTimer);countTimer=setTimeout(()=>run('count'),300);};
$('text-operation').onchange=()=>{runner.invalidate();for(const element of document.querySelectorAll('[data-options]'))element.hidden=element.dataset.options!==$('text-operation').value;};
for(const element of $('tool-root').querySelectorAll('select,input:not([type=file])'))element.addEventListener('change',()=>{runner.invalidate();resetResult();});
for(const id of ['find','replacement'])$(`text-${id}`).oninput=()=>{runner.invalidate();resetResult();};
$('text-clear').onclick=()=>{$('text-input').value='';$('text-input').oninput();};
$('text-copy').onclick=async()=>{if(result)await copyText(await result.blob.text());};
$('text-download').onclick=()=>{if(result)downloadText(result.blob,'text-result.txt');};
$('text-use').onclick=async()=>{if(result){const source=result,generation=importGeneration;const value=await source.blob.text();if(generation!==importGeneration||result!==source)return;if(new Blob([value]).size>10*1024**2)return showError({code:'text.inputLimit'});$('text-input').value=value;$('text-input').oninput();}};
async function importFile(file){const generation=++importGeneration;runner.invalidate();if(!file)return;resetResult();counts=undefined;renderCounts();if(file.size>10*1024**2)return showError({code:'text.inputLimit'});try{const value=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(generation!==importGeneration)return;$('text-input').value=value;$('text-input').oninput();}catch{if(generation===importGeneration)showError({code:'text.invalidText'});}}
$('text-file').onchange=()=>{void importFile($('text-file').files[0]);$('text-file').value='';};
$('text-input').ondragover=event=>event.preventDefault();$('text-input').ondrop=event=>{event.preventDefault();void importFile(event.dataTransfer.files[0]);};
onLanguageChange(()=>{renderCounts();if($('text-input').value)run('count');});

addEventListener('pagehide',()=>{clearTimeout(countTimer);importGeneration++;});

const textAdvanced=document.createElement('details');textAdvanced.id='text-advanced';
textAdvanced.innerHTML='<summary data-i18n="office.advanced"></summary>';
const textFields=$('text-operation').closest('.tool-fields');textFields.before(textAdvanced);textAdvanced.append(textFields);
const textOptions=$('text-run').closest('section');document.querySelector('#tool-root .tool-grid').before(textOptions);
const textActions=$('text-input').parentElement.querySelector('.tool-actions');textActions.prepend($('text-run'),$('text-cancel'));
const guide=addTaskGuide('text',[{id:'dedupe',key:'text.dedupe'},{id:'extract',key:'text.extract'},{id:'replace',key:'text.replace'},{id:'mask',key:'text.mask'}],{
 choose(task){$('text-operation').value=task==='dedupe'?'lines':task;if(task==='dedupe')$('text-lines').value='dedupe';$('text-operation').dispatchEvent(new Event('change'));},
 example(){
  const operation=$('text-operation').value;
  $('text-input').value=operation==='extract'?'Alice alice@example.com, 13812345678\nBob bob@example.com, 13912345678':operation==='replace'?'Hello Acme. Welcome to Acme.':operation==='mask'?'Alice: alice@example.com, 13812345678':'Alice\nBob\nAlice\nCharlie\nBob';
  if(operation==='replace'){$('text-find').value='Acme';$('text-replacement').value='LisTools';}
  $('text-input').oninput();run();
 }
});
$('text-operation').addEventListener('change',()=>guide.select($('text-operation').value==='lines'?'dedupe':$('text-operation').value));
const textGuide=$('text-task-dedupe').closest('section');textGuide.append(textAdvanced);
textOptions.querySelector('h2').remove();textOptions.querySelector('.tool-actions').remove();
const showTextOptions=()=>{textOptions.hidden=!['extract','replace','mask'].includes($('text-operation').value);};
$('text-operation').addEventListener('change',showTextOptions);showTextOptions();
translateDOM(textAdvanced);
