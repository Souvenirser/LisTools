import {pendingFeedback} from './tools/shared/pending-feedback.js';
import {mountResultShortcut} from './tools/shared/workspace.js';
import {resolveTaskRoute} from './tools/shared/navigation.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import { version } from '../package.json';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap, history as editorHistory, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { tools, categories, findTools, defaults, conversionExample } from './tools/convert/registry.js';
import { limits, decodeText, validText } from './tools/convert/bytes.js';
import { createConversionController } from './tools/convert/controller.js';
import { createTextState } from './tools/convert/editor.js';
import { bindFileDrop } from './tools/json/file-drop.js';
import { t, language, onLanguageChange, translateDOM } from './i18n.js';
import { createMd5View } from './md5.js';
import {textLabel} from './tools/shared/labels.js';
import {colord} from 'colord';
import './style.css';
import './convert-style.css';

const $=id=>document.getElementById(id);
const tr=textLabel;
const label=values=>textLabel(...values);
const messages={
  description:['编码、格式与字节转换，完全离线运行。','Encoding, formats and byte conversion. Entirely offline.'],
  search:['搜索工具','Search tools'],category:['分类','Category'],noTools:['没有匹配的工具','No matching tools'],
  input:['输入','Input'],output:['输出','Output'],text:['文本','Text'],file:['文件 / 字节','File / bytes'],chooseFile:['选择文件','Choose file'],searchText:['搜索文本','Find text'],
  run:['运行','Run'],cancel:['取消','Cancel'],auto:['小文本自动运行','Auto-run small text'],reuse:['结果作为输入','Use result as input'],copy:['复制全文','Copy full text'],download:['下载完整结果','Download full result'],clear:['清空','Clear'],locate:['定位错误','Locate error'],
  limits:['文本 10 MiB · 文件 50 MiB · 输出 100 MiB','Text 10 MiB · File 50 MiB · Output 100 MiB'],
  drop:['拖入单个文件','Drop one file'],dropHint:['保留原始字节，导入后手动运行','Preserves raw bytes. Run manually after importing.']
};
let tool=tools.find(item=>item.id===resolveTaskRoute('convert',location.hash).task) || tools[0];
let keepPresentation=false, explicitRun=false;
let file, filePreview='', textBuffer='', fileRevision=0, result, lastState={status:'idle'}, options=defaults(tool), notificationTimer;
const editable=new Compartment(), inputLocale=new Compartment(), outputLocale=new Compartment();
let md5;
function notify(message) {
  clearTimeout(notificationTimer); $('notification').textContent=message; $('notification').hidden=false;
  notificationTimer=setTimeout(()=>{$('notification').hidden=true;},3500);
}
function size(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1024**2 ? `${(bytes/1024).toFixed(1)} KiB` : `${(bytes/1024**2).toFixed(2)} MiB`; }
function setDocument(editor,text) { if(editor.state.doc.toString()===text)return;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text},annotations:Transaction.userEvent.of('set')}); }
const common=[lineNumbers(),search(),keymap.of([...defaultKeymap,...historyKeymap,...searchKeymap]),EditorView.lineWrapping,EditorView.contentAttributes.of({spellcheck:'false',autocorrect:'off',autocapitalize:'off'})];
const source=new EditorView({parent:$('convert-source'),state:createTextState({extensions:[...common,inputLocale.of([]),editorHistory(),highlightActiveLine(),editable.of([EditorState.readOnly.of(false),EditorView.editable.of(true)]),EditorView.contentAttributes.of({'aria-label':label(messages.input)}),
  EditorState.transactionFilter.of(transaction=> {
    if (!transaction.docChanged || transaction.annotation(Transaction.userEvent)==='set') return transaction;
    if (new TextEncoder().encode(transaction.newDoc.toString()).length <= limits.text) return transaction;
    notify(tool.id==='md5'?t('md5.errors.inputSize'):t('uiText.s8a746896')); return [];
  }),
  EditorView.updateListener.of(update=> {if(update.docChanged && !update.transactions.some(tx=>tx.annotation(Transaction.userEvent)==='set')) inputChanged();})
]})});
const output=new EditorView({parent:$('convert-result'),state:createTextState({extensions:[...common,outputLocale.of([]),EditorState.readOnly.of(true),EditorView.editable.of(false),EditorView.contentAttributes.of({'aria-label':label(messages.output)})]})});

function inputInfo() {
  $('convert-run').disabled=$('input-mode').value==='file'&&!file;
  if(tool.id==='md5') {$('convert-input-info').textContent=`${size(new TextEncoder().encode(source.state.doc.toString()).length)} · ${$('md5-representation')?.value || 'utf-8'}`;return;}
  $('convert-input-info').textContent=$('input-mode').value==='file' ? file ? `${file instanceof File ? file.name : t('uiText.s5369b2a5')} · ${size(file.size)}${file.size>limits.preview ? t('uiText.sc653ecb9') : ''}` : t('uiText.s14c9046d') : `${size(new TextEncoder().encode(source.state.doc.toString()).length)} · UTF-8`;
}
function clearKey() {
  if (tool.id==='hmac') {
    keepPresentation=false;options.key=''; const field=$('option-key'); if(field) field.value='';
  }
}
function toolHint(){return tool.category==='escape'?t(`direct.developer.convert.${tool.id}.help`):tool.category==='encoding'?t(tool.id==='base58'?'ux.base58Hint':'ux.encodingHint'):tool.hint===tool.usage?t(`direct.developer.convert.${tool.id}.usage`):label(tool.hint);}
const usage=document.createElement('p');usage.id='convert-usage';const help=document.createElement('details');help.id='convert-help';const helpSummary=document.createElement('summary');helpSummary.dataset.i18n='direct.developer.convertHelp';help.append(helpSummary,$('tool-hint'));document.querySelector('.convert-tool-heading').append(usage,help);
const reasonCodes=new Set(['CsvColumns','CsvHeaders','CsvJsonCell','CsvArrayHeader','CsvNestedValue','CsvRowShape','XmlOrdered','QueryArrays']);
const noticeCodes=new Set(['StructureOnly','CsvStrings','CsvTextExport','ByteHex']);
const charsetNote=document.createElement('p');charsetNote.id='convert-charset-note';charsetNote.className='tool-note';$('tool-options').after(charsetNote);
function charsetSource(){const text=tool.id==='charset'&&$('input-mode').value==='text';if(tool.id==='charset'&&$('option-from'))$('option-from').disabled=text;charsetNote.hidden=!text;charsetNote.textContent=text?t('polishData.charsetSource'):'';}
const exampleButton=document.createElement('button');exampleButton.id='convert-example';exampleButton.type='button';exampleButton.className='quiet';help.after(exampleButton);
exampleButton.onclick=()=>{const sample=conversionExample(tool.id,options);if(!sample)return;if((file||source.state.doc.length||result)&&!confirm(t('office.exampleConfirm')))return;controller.invalidate();fileRevision++;file=undefined;filePreview='';textBuffer=sample.text;$('input-mode').value='text';Object.assign(options,sample.options);source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(false),EditorView.editable.of(true)])});setDocument(source,sample.text);renderOptions();conversionAction();inputInfo();source.focus();};
function render(state) {
  if(tool.id==='md5' && md5) {md5.onState(state);return;}
  if(state.status==='ready')keepPresentation=true;else if(state.status!=='pending')keepPresentation=false;
  lastState=state; result=state.status==='ready'?state:undefined;
  $('convert-output-panel').dataset.status=state.status;$('convert-output-panel').setAttribute('aria-busy',String(state.status==='pending'));
  $('convert-cancel').disabled=state.status!=='pending';$('convert-cancel').hidden=false;
  for(const id of ['result-to-input','convert-download']){$(id).disabled=!result;if(state.status!=='pending')$(id).hidden=!result;}
  $('convert-copy').disabled=!result?.copyBlob;if(state.status!=='pending')$('convert-copy').hidden=!result?.copyBlob;
  if(state.status!=='pending'||!keepPresentation){setDocument(output,result?.preview || '');
  $('preview-info').textContent=result ? result.truncated ? t('uiText.sb4b12946') : result.previewKind==='hex' ? t('uiText.saedfe438') : t('uiText.s1b52df0') : '';
  }
  $('convert-output-info').textContent=result ? `${size(result.outputBytes)} · ${result.durationMs} ms` : '';
  const errorKey=state.code==='TextEncodingError'?'md5.errors.encoding':state.code==='InvalidEncodedInput'&&['base64','base64url','hex'].includes(tool.id)?'md5.errors.representation':'common.retry';
  const text=state.status==='error' ? `${t('common.error')} · ${reasonCodes.has(state.reasonCode)?t(`polishData.errors.${state.reasonCode}`,state.params):t(errorKey)}${state.line ? t('uiText.s4e06237',{p0:state.line,p1:state.column || 1}) : ''}` : state.status==='pending' ? t('uiText.s307d4207') : state.status==='ready' ? t('uiText.scc3240ba',{p0:size(state.inputBytes),p1:size(state.outputBytes)}) : state.status==='cancelled' ? t('uiText.s86a5b81a') : t('uiText.sfc1b6be8');
  $('convert-error-detail').hidden=state.status!=='error';$('convert-error-raw').textContent=state.status==='error'?state.message||state.code||'':'';
  $('convert-status').textContent=text; $('convert-status').classList.toggle('is-error',state.status==='error');
  $('convert-notice').textContent=result?.notices?.length?result.notices.filter(notice=>noticeCodes.has(notice.code)).map(notice=>t(`polishData.notices.${notice.code}`,notice.params)).join(' '):result?.notice?toolHint():'';
  if(state.status==='error'&&explicitRun){$('convert-error-detail').open=true;const target=state.position!==undefined&&$('input-mode').value==='text'?source.contentDOM:$('convert-status');if(target===source.contentDOM){source.dispatch({selection:{anchor:Math.min(state.position,source.state.doc.length)},scrollIntoView:true});source.focus();}else{target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}}
  if(['ready','error','idle','cancelled'].includes(state.status))explicitRun=false;
  const chip=$('convert-color');if(chip&&(state.status!=='pending'||!keepPresentation)){const color=tool.id==='color'&&result?colord(options.format==='hsv'?JSON.parse(result.preview):result.preview):undefined;chip.hidden=!color?.isValid();if(color?.isValid())chip.style.backgroundColor=color.toRgbString();}
  $('convert-locate').hidden=state.status!=='error' || state.position===undefined || $('input-mode').value!=='text';
  if(['ready','error','cancelled'].includes(state.status)) clearKey();
}
const resultFeedback=pendingFeedback('convert-status');
const controller=createConversionController({createWorker:()=>new Worker(new URL('./tools/convert/worker.js',import.meta.url),{type:'module'}),onState:state=>{resultFeedback(state.status==='pending');render(state);},onEvent:event=>{if(tool.id==='md5')md5.onEvent(event);}});
md5=createMd5View({source,output,setDocument,setEditable:value=>source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(!value),EditorView.editable.of(value)])}),controller,notify});
md5.deactivate();
function request() {
  return {toolId:tool.id,input:$('input-mode').value==='file'?file:source.state.doc.toString(),options:{...options, ...(Object.hasOwn(options,'header')?{header:options.header==='true'}:{})}};
}
function execute(auto=false) {
  if(tool.id==='md5') {md5.execute(auto);return;}
  inputInfo();
  if(auto&&$('input-mode').value==='text'&&!source.state.doc.length){controller.invalidate();return;}
  if($('input-mode').value==='file' && !file) {controller.invalidate();return;}
  explicitRun=!auto;controller.process(request(),{auto,wait:350});
}
function inputChanged() {keepPresentation=false;if(tool.id==='md5') {inputInfo();md5?.changed();return;}  if($('convert-auto').checked) execute(true); else {inputInfo();controller.invalidate();} }
function renderOptions() {
  exampleButton.hidden=!conversionExample(tool.id,options);exampleButton.textContent=t('ux.viewExample');
  $('tool-options').replaceChildren(...tool.options.map(option=> {
    const wrapper=document.createElement('div');wrapper.className='convert-option'+(option.values?' is-choice':'');const caption=document.createElement('label');caption.htmlFor=`option-${option.key}`;caption.id=`option-${option.key}-label`;caption.textContent=label(option.label);if(option.key==='direction')caption.hidden=true;wrapper.append(caption);
    const field=document.createElement(option.values?'select':'input'); field.id=`option-${option.key}`;
    if(option.values) for(const [value,zh,en] of option.values) {const item=document.createElement('option');item.value=value;item.textContent=tr(zh,en);field.append(item);}
    else {field.type=option.type || 'text';field.autocomplete='off';field.spellcheck=false;if(option.min)field.min=option.min;if(option.max)field.max=option.max;}
    field.value=options[option.key];
    field.addEventListener(option.values?'change':'input',()=> {if(options[option.key]===field.value)return;options[option.key]=field.value;if(resolveTaskRoute('convert',location.hash).preset)history.replaceState(null,'',`#${tool.id}`);conversionAction();inputChanged();});
    wrapper.append(field); return wrapper;
  }));
  charsetSource();
}
function renderCatalog(reveal=false) {
  const list=$('convert-tool-list'),scroll=list.scrollTop,matches=findTools($('convert-search').value,t);
  const elements=[];
  for(const category of categories) {
    const items=matches.filter(item=>item.category===category.id);if(!items.length)continue;
    const section=document.createElement('section');section.className='convert-catalog-group';section.dataset.category=category.id;
    const heading=document.createElement('h3');heading.id=`convert-category-${category.id}`;const name=document.createElement('span');name.textContent=label(category.name);const count=document.createElement('span');count.className='convert-category-count';count.textContent=String(items.length);count.setAttribute('aria-hidden','true');heading.append(name,count);section.setAttribute('aria-labelledby',heading.id);section.append(heading);
    for(const item of items) {
      const link=document.createElement('a');link.href=`#${item.id}`;link.textContent=item.id==='md5'?t('md5.name'):label(item.name);
      if(item.id===tool.id)link.setAttribute('aria-current','page');section.append(link);
    }
    elements.push(section);
  }
  list.replaceChildren(...elements);list.scrollTop=scroll;
  $('convert-no-tools').hidden=matches.length!==0;
  if(reveal)list.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'});
}
$('convert-search').addEventListener('input',()=>renderCatalog());
function chooseTool(next,{preset,fromRoute=false}={}) {
  const fromFiles=tool.id==='md5'&&next.id!=='md5'&&md5.mode==='files';
  const inputFiles=fromFiles?md5.getInputFiles():[];
  clearKey();md5.deactivate();controller.invalidate();fileRevision++;tool=next;options=defaults(tool);
  if(preset)options.direction=preset.value;
  if(fromFiles){
    if($('input-mode').value==='text')textBuffer=source.state.doc.toString();
    file=inputFiles.length===1&&inputFiles[0].size<=limits.file?inputFiles[0]:undefined;
    filePreview='';$('input-mode').value='file';setDocument(source,'');
    if(!file)notify(t('md5.chooseSingleFile'));
  }
  history.replaceState(null,'',`#${preset?.id||tool.id}`);closeCatalog();
  $('tool-title').textContent=label(tool.name);$('tool-hint').textContent=toolHint();
  renderOptions();renderCatalog(true);
  if(tool.id==='md5') {md5.activate({inputFile:$('input-mode').value==='file'?file:undefined});} else {
    const binary=$('input-mode').value==='file';
    source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(binary),EditorView.editable.of(!binary)])});
    if(binary)setDocument(source,filePreview);
    lastState={status:'idle'};document.querySelector('.page-heading h1').textContent=t('common.convert');document.title=`${t('common.convert')} · LisTools`;translate();if(fromRoute)inputInfo();else inputChanged();
    if(binary&&file&&!filePreview)void importFile(file);
  }
}
async function importFile(next) {
  if(next.size>limits.file) {notify(t('uiText.se7c25cfb'));return;}
  if($('input-mode').value==='text')textBuffer=source.state.doc.toString();
  controller.invalidate(); const revision=++fileRevision;
  file=next;$('input-mode').value='file'; source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(true),EditorView.editable.of(false)])});
  filePreview='';setDocument(source,'');inputInfo();charsetSource();conversionAction();
  try {
    const bytes=new Uint8Array(await next.slice(0,limits.preview).arrayBuffer());
    if(revision!==fileRevision) return;
    try {filePreview=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes,{stream:next.size>limits.preview});}
    catch {filePreview=Array.from(bytes.subarray(0,Math.floor(limits.preview/3)),b=>b.toString(16).padStart(2,'0')).join(' ');}
    setDocument(source,filePreview);inputInfo();
  } catch {if(revision===fileRevision) notify(t('uiText.s620fdc4d'));}
}
$('tool-options').addEventListener('submit',event=>{event.preventDefault();execute();});
$('convert-run').addEventListener('click',()=>execute());$('convert-cancel').addEventListener('click',()=>controller.cancel());
$('convert-auto').addEventListener('change',inputChanged);
$('choose-file').addEventListener('click',()=>$('convert-file').click());
$('convert-file').addEventListener('change',()=> {const selected=$('convert-file').files[0];if(selected) void importFile(selected);$('convert-file').value='';});
$('input-mode').addEventListener('change',()=> {
  fileRevision++;controller.invalidate();
  const binary=$('input-mode').value==='file';
  if(binary)textBuffer=source.state.doc.toString();
  source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(binary),EditorView.editable.of(!binary)])});
  setDocument(source,binary?filePreview:textBuffer);inputInfo();conversionAction();charsetSource();
  if(binary&&file&&!filePreview)void importFile(file);
});
$('convert-clear').addEventListener('click',()=> {
  fileRevision++;file=undefined;filePreview='';textBuffer='';clearKey();$('input-mode').value='text';
  controller.invalidate();source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(false),EditorView.editable.of(true)])});setDocument(source,'');inputInfo();charsetSource();conversionAction();source.focus();
});
$('input-search').addEventListener('click',()=>openSearchPanel(source));$('output-search').addEventListener('click',()=>openSearchPanel(output));
$('convert-locate').addEventListener('click',()=>{const at=Math.min(lastState.position,source.state.doc.length);source.dispatch({selection:{anchor:at},scrollIntoView:true});source.focus();});
$('convert-copy').addEventListener('click',async()=> {
  const current=result;if(!current?.copyBlob)return;
  try {
    const text=decodeText(new Uint8Array(await current.copyBlob.arrayBuffer()));
    if(result!==current)return;
    await navigator.clipboard.writeText(text);notify(t('common.copied'));
  } catch {notify(t('uiText.s997fe268'));}
});
$('convert-download').addEventListener('click',()=> {
  if(!result)return;const url=URL.createObjectURL(result.blob),link=document.createElement('a');
  link.href=url;link.download=`listools-${tool.id}.${result.extension}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('result-to-input').addEventListener('click',async()=> {
  const current=result;if(!current)return;
  if(current.kind==='bytes') {await importFile(current.blob);return;}
  if(current.blob.size>limits.text) {notify(t('uiText.se64a1707'));return;}
  const text=decodeText(new Uint8Array(await current.blob.arrayBuffer()));
  if(result!==current)return;
  validText(text);fileRevision++;textBuffer=text;$('input-mode').value='text';
  source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(false),EditorView.editable.of(true)])});setDocument(source,text);inputChanged();source.focus();
});
window.addEventListener('keydown',event=> {if(event.target.closest?.('.tool-menu'))return;if((event.ctrlKey || event.metaKey)&&event.key==='Enter'){event.preventDefault();execute();}});
window.addEventListener('hashchange',()=>{
 const route=resolveTaskRoute('convert',location.hash),next=tools.find(item=>item.id===route.task)||tools[0];
 if(next===tool){closeCatalog();if(!route.preset||options.direction===route.preset.value)return;options.direction=route.preset.value;controller.invalidate();renderOptions();conversionAction();inputInfo();return;}
 chooseTool(next,{preset:route.preset,fromRoute:Boolean(route.preset)});
});
window.addEventListener('pagehide',()=>{controller.cancel();clearKey();md5.clearKey();});
bindFileDrop(document,{allowMultiple:()=>tool.id==='md5'&&md5.mode==='files',onFiles:files=>md5.importFiles(files),onFile:next=>{if(tool.id==='md5'){notify(t('md5.emptyFileQueue'));return;}void importFile(next);},onActive:active=>{$('convert-drop-overlay').hidden=!active;},onError:notify,multipleMessage:t('uiText.s9105ac19')});
function translate() {
  translateDOM(convertError);
  renderCatalog();
  $('convert-catalog-toggle').textContent=t('experience.chooseConvert',{name:tool.id==='md5'?t('md5.name'):label(tool.name)});
  helpSummary.textContent=t('direct.developer.convertHelp');
  const phrases={'Find':t('common.search'),'Replace':t('common.replace'),'replace':t('common.replace'),'replace all':t('common.replaceAll'),'match case':t('common.matchCase'),'regexp':t('common.regularExpression'),'by word':t('common.wholeWord'),'next':t('common.next'),'previous':t('common.previous'),'all':t('common.selectAll'),'close':t('common.close')};
  for(const [view,compartment,key] of [[source,inputLocale,'common.input'],[output,outputLocale,'common.result']])view.dispatch({effects:compartment.reconfigure([EditorState.phrases.of(phrases),EditorView.contentAttributes.of({'aria-label':t(key),dir:'ltr'})])});
  if(tool.id==='md5') {md5.translate();return;}
  for(const element of document.querySelectorAll('[data-convert]')) element.textContent=label(messages[element.dataset.convert]);
  $('tool-title').textContent=label(tool.name);$('tool-hint').textContent=toolHint();renderOptions();inputInfo();render(lastState);conversionAction();
}
const convertError=$('convert-error-detail');
const catalog=$('convert-catalog'),catalogToggle=$('convert-catalog-toggle');
catalogToggle.removeAttribute('data-i18n');
const catalogHost=catalog.closest('main');
function closeCatalog(){if(catalog.hasAttribute('popover')&&catalog.matches(':popover-open'))catalog.hidePopover();}
catalog.addEventListener('click',event=>{if(event.target.closest('a[href^="#"]'))closeCatalog();});
function catalogLayout(){const style=getComputedStyle(catalogHost),narrow=catalogHost.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)<1280;catalogHost.classList.toggle('catalog-overlay',narrow);if(narrow)catalog.setAttribute('popover','auto');else{closeCatalog();catalog.removeAttribute('popover');}}
new ResizeObserver(catalogLayout).observe(catalogHost);catalogLayout();catalogToggle.onclick=()=>{if(catalog.hasAttribute('popover'))catalog.showPopover();};catalog.addEventListener('toggle',event=>{catalogToggle.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')$('convert-search').focus();});
function conversionAction(){if(!$('convert-run'))return;const direction=tool.options.find(option=>option.key==='direction'),choice=direction?.values.find(value=>value[0]===options.direction);const operation=tool.options.find(option=>['operation','style','form','ending','format'].includes(option.key)),operationChoice=operation?.values?.find(value=>value[0]===options[operation.key]);$('convert-run').textContent=choice?tr(choice[1],choice[2]):operationChoice?tr(operationChoice[1],operationChoice[2]):tool.id==='jwt'?tr('解码','Decode'):t(['hash','hmac'].includes(tool.id)?'calculator.calculate':'common.transform');
  $('convert-usage').textContent=t(`direct.developer.convert.${tool.id}.usage`);
  let pair=['input','output'].map(field=>t(`direct.developer.convert.${tool.id}.${field}`));
  if(options.direction==='decode')pair.reverse();
  if(tool.category==='encoding'&&options.charset){const textIndex=options.direction==='decode'?1:0;pair[textIndex]+=` · ${options.charset}`;}
  if(tool.id==='charset')pair=[`${pair[0]} · ${$('input-mode').value==='file'?options.from:'Unicode'}`,`${pair[1]} · ${options.to}`];
  if(tool.category==='compression'){pair=options.direction==='decode'?[`${label(tool.name)} · ${options.inputFormat}`,`${t('common.result')} · ${options.outputFormat}`]:[`${t('common.input')} · ${options.inputFormat}`,`${label(tool.name)} · ${options.outputFormat}`];}
  if(['radix','bytes-unit','duration-unit'].includes(tool.id))pair=[`${pair[0]} · ${options.from}`,`${pair[1]} · ${options.to}`];
  if(['hash','hmac'].includes(tool.id))pair[1]+=` · ${options.algorithm.toUpperCase()}`;
  $('convert-input-panel').querySelector('h2').textContent=pair[0];$('convert-output-panel').querySelector('h2').textContent=pair[1];
}
$('app-version').textContent=`v${version}`;
onLanguageChange(translate);translate();chooseTool(tool,{preset:resolveTaskRoute('convert',location.hash).preset,fromRoute:Boolean(resolveTaskRoute('convert',location.hash).preset)});

registerContentCheck(()=>Boolean(file||source.state.doc.length||result&&(result.inputBytes>0||result.outputBytes>0)||md5.hasContent()));

function syncDirectionButtons(){
 const select=$('option-direction');if(!select)return;
 let group=$('convert-direction-switch');if(!group){group=document.createElement('div');group.id='convert-direction-switch';group.className='segmented-control';group.setAttribute('role','group');group.setAttribute('aria-labelledby','option-direction-label');select.after(group);select.hidden=true;
  for(const option of select.options){const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.onclick=()=>{button.focus({preventScroll:true});if(select.value===option.value)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));syncDirectionButtons();};group.append(button);}
 }
 for(const button of group.children){const option=[...select.options].find(option=>option.value===button.dataset.value);button.textContent=option.textContent;button.setAttribute('aria-pressed',String(select.value===option.value));}
}
new MutationObserver(syncDirectionButtons).observe($('tool-options'),{childList:true});onLanguageChange(syncDirectionButtons);syncDirectionButtons();

mountResultShortcut($('convert-run').parentElement,$('convert-output-panel'),()=>tool.id!=='md5'&&keepPresentation);
