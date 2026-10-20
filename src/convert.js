import { version } from '../package.json';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap, history as editorHistory, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { tools, categories, findTools, defaults } from './tools/convert/registry.js';
import { limits, decodeText, validText } from './tools/convert/bytes.js';
import { createConversionController } from './tools/convert/controller.js';
import { createTextState } from './tools/convert/editor.js';
import { bindFileDrop } from './tools/json/file-drop.js';
import { t, language, onLanguageChange } from './i18n.js';
import { createMd5View } from './md5.js';
import './style.css';
import './convert-style.css';

const $=id=>document.getElementById(id);
const tr=(zh,en)=>language().startsWith('zh')?zh:en;
const label=values=>values[language().startsWith('zh')?0:1];
const messages={
  description:['编码、格式与字节转换，完全离线运行。','Encoding, formats and byte conversion. Entirely offline.'],
  search:['搜索工具','Search tools'],category:['分类','Category'],noTools:['没有匹配的工具','No matching tools'],
  input:['输入','Input'],output:['输出','Output'],text:['文本','Text'],file:['文件 / 字节','File / bytes'],chooseFile:['选择文件','Choose file'],searchText:['搜索文本','Find text'],
  run:['运行','Run'],cancel:['取消','Cancel'],auto:['小文本自动运行','Auto-run small text'],reuse:['结果作为输入','Use result as input'],copy:['复制全文','Copy full text'],download:['下载完整结果','Download full result'],clear:['清空','Clear'],locate:['定位错误','Locate error'],
  limits:['文本 10 MiB · 文件 50 MiB · 输出 100 MiB','Text 10 MiB · File 50 MiB · Output 100 MiB'],
  drop:['拖入单个文件','Drop one file'],dropHint:['保留原始字节，导入后手动运行','Preserves raw bytes. Run manually after importing.']
};
let tool=tools.find(item=>item.id===location.hash.slice(1)) || tools[0];
let file, filePreview='', fileRevision=0, result, lastState={status:'idle'}, options=defaults(tool), notificationTimer;
const editable=new Compartment(), inputLocale=new Compartment(), outputLocale=new Compartment();
let md5;
function notify(message) {
  clearTimeout(notificationTimer); $('notification').textContent=message; $('notification').hidden=false;
  notificationTimer=setTimeout(()=>{$('notification').hidden=true;},3500);
}
function size(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1024**2 ? `${(bytes/1024).toFixed(1)} KiB` : `${(bytes/1024**2).toFixed(2)} MiB`; }
function setDocument(editor,text) { editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text},annotations:Transaction.userEvent.of('set')}); }
const common=[lineNumbers(),search(),keymap.of([...defaultKeymap,...historyKeymap,...searchKeymap]),EditorView.lineWrapping,EditorView.contentAttributes.of({spellcheck:'false',autocorrect:'off',autocapitalize:'off'})];
const source=new EditorView({parent:$('convert-source'),state:createTextState({extensions:[...common,inputLocale.of([]),editorHistory(),highlightActiveLine(),editable.of([EditorState.readOnly.of(false),EditorView.editable.of(true)]),EditorView.contentAttributes.of({'aria-label':label(messages.input)}),
  EditorState.transactionFilter.of(transaction=> {
    if (!transaction.docChanged || transaction.annotation(Transaction.userEvent)==='set') return transaction;
    if (new TextEncoder().encode(transaction.newDoc.toString()).length <= limits.text) return transaction;
    notify(tool.id==='md5'?t('md5.errors.inputSize'):tr('文本超过 10 MiB，未应用此次编辑','Text exceeds 10 MiB; edit was not applied')); return [];
  }),
  EditorView.updateListener.of(update=> {if(update.docChanged && !update.transactions.some(tx=>tx.annotation(Transaction.userEvent)==='set')) inputChanged();})
]})});
const output=new EditorView({parent:$('convert-result'),state:createTextState({extensions:[...common,outputLocale.of([]),EditorState.readOnly.of(true),EditorView.editable.of(false),EditorView.contentAttributes.of({'aria-label':label(messages.output)})]})});

function inputInfo() {
  if(tool.id==='md5') {$('convert-input-info').textContent=`${size(new TextEncoder().encode(source.state.doc.toString()).length)} · ${$('md5-representation')?.value || 'utf-8'}`;return;}
  $('convert-input-info').textContent=$('input-mode').value==='file' ? file ? `${file instanceof File ? file.name : tr('原始结果字节','Raw result bytes')} · ${size(file.size)}${file.size>limits.preview ? tr(' · 仅预览前 1 MiB',' · First 1 MiB preview only') : ''}` : tr('请选择或拖入文件','Choose or drop a file') : `${size(new TextEncoder().encode(source.state.doc.toString()).length)} · UTF-8`;
}
function clearKey() {
  if (tool.id==='hmac') {
    options.key=''; const field=$('option-key'); if(field) field.value='';
  }
}
function render(state) {
  if(tool.id==='md5' && md5) {md5.onState(state);return;}
  lastState=state; result=state.status==='ready'?state:undefined;
  $('convert-output-panel').dataset.status=state.status;
  $('convert-cancel').disabled=state.status!=='pending';
  for(const id of ['result-to-input','convert-download']) $(id).disabled=!result;
  $('convert-copy').disabled=!result?.copyBlob;
  setDocument(output,result?.preview || '');
  $('preview-info').textContent=result ? result.truncated ? tr('仅显示前 1 MiB；复制/下载使用完整结果','First 1 MiB preview; copy/download uses the full result') : result.previewKind==='hex' ? tr('Hex 字节预览','Hex byte preview') : tr('完整预览','Full preview') : '';
  $('convert-output-info').textContent=result ? `${size(result.outputBytes)} · ${result.durationMs} ms` : '';
  const text=state.status==='error' ? `${state.message}${state.line ? tr(` · 第 ${state.line} 行，第 ${state.column || 1} 列`,` · Line ${state.line}, column ${state.column || 1}`) : ''}` : state.status==='pending' ? tr('正在转换，可随时取消…','Converting… You can cancel at any time.') : state.status==='ready' ? tr(`已完成 · 输入 ${size(state.inputBytes)} → 输出 ${size(state.outputBytes)}`,`Completed · ${size(state.inputBytes)} → ${size(state.outputBytes)}`) : state.status==='cancelled' ? tr('任务已取消，结果已清除','Cancelled; result cleared') : tr('等待运行；文件及超过 256 KiB 的文本需手动运行','Ready to run. Files and text over 256 KiB run manually.');
  $('convert-status').textContent=text; $('convert-status').classList.toggle('is-error',state.status==='error');
  $('convert-notice').textContent=result?.notice || '';
  $('convert-locate').hidden=state.status!=='error' || state.position===undefined || $('input-mode').value!=='text';
  if(['ready','error','cancelled'].includes(state.status)) clearKey();
}
const controller=createConversionController({createWorker:()=>new Worker(new URL('./tools/convert/worker.js',import.meta.url),{type:'module'}),onState:render,onEvent:event=>{if(tool.id==='md5')md5.onEvent(event);}});
md5=createMd5View({source,output,setDocument,setEditable:value=>source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(!value),EditorView.editable.of(value)])}),controller,notify});
md5.deactivate();
function request() {
  return {toolId:tool.id,input:$('input-mode').value==='file'?file:source.state.doc.toString(),options:{...options, ...(Object.hasOwn(options,'header')?{header:options.header==='true'}:{})}};
}
function execute(auto=false) {
  if(tool.id==='md5') {md5.execute(auto);return;}
  inputInfo();
  if($('input-mode').value==='file' && !file) {controller.invalidate();return;}
  controller.process(request(),{auto,wait:350});
}
function inputChanged() { if(tool.id==='md5') {inputInfo();md5?.changed();return;}  if($('convert-auto').checked) execute(true); else {inputInfo();controller.invalidate();} }
function renderOptions() {
  $('tool-options').replaceChildren(...tool.options.map(option=> {
    const wrapper=document.createElement('label'); wrapper.textContent=label(option.label);
    const field=document.createElement(option.values?'select':'input'); field.id=`option-${option.key}`;
    if(option.values) for(const [value,zh,en] of option.values) {const item=document.createElement('option');item.value=value;item.textContent=tr(zh,en);field.append(item);}
    else {field.type=option.type || 'text';field.autocomplete='off';field.spellcheck=false;if(option.min)field.min=option.min;if(option.max)field.max=option.max;}
    field.value=options[option.key];
    field.addEventListener(option.values?'change':'input',()=> {options[option.key]=field.value;inputChanged();});
    wrapper.append(field); return wrapper;
  }));
}
function renderCatalog(reveal=false) {
  const list=$('convert-tool-list'),scroll=list.scrollTop,matches=findTools($('convert-search').value);
  const elements=[];
  for(const category of categories) {
    const items=matches.filter(item=>item.category===category.id);if(!items.length)continue;
    const heading=document.createElement('h3');heading.textContent=label(category.name);elements.push(heading);
    for(const item of items) {
      const link=document.createElement('a');link.href=`#${item.id}`;link.textContent=item.id==='md5'?t('md5.name'):label(item.name);
      if(item.id===tool.id)link.setAttribute('aria-current','page');elements.push(link);
    }
  }
  list.replaceChildren(...elements);list.scrollTop=scroll;
  $('convert-no-tools').hidden=matches.length!==0;
  if(reveal)list.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'});
}
$('convert-search').addEventListener('input',()=>renderCatalog());
function chooseTool(next) {
  controller.invalidate(); clearKey(); md5.deactivate(); fileRevision++; tool=next;options=defaults(tool);
  history.replaceState(null,'',`#${tool.id}`);
  $('tool-title').textContent=label(tool.name);$('tool-hint').textContent=label(tool.hint);
  renderOptions();renderCatalog(true);
  if(tool.id==='md5') {file=undefined;filePreview='';$('input-mode').value='text';md5.activate();} else {lastState={status:'idle'};document.querySelector('.page-heading h1').textContent=t('common.convert');document.title=`${t('common.convert')} · LisTools`;translate();inputChanged();}
}
async function importFile(next) {
  if(next.size>limits.file) {notify(tr('文件超过 50 MiB，未导入','File exceeds 50 MiB; not imported'));return;}
  controller.invalidate(); const revision=++fileRevision;
  file=next;$('input-mode').value='file'; source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(true),EditorView.editable.of(false)])});
  filePreview='';setDocument(source,'');inputInfo();
  try {
    const bytes=new Uint8Array(await next.slice(0,limits.preview).arrayBuffer());
    if(revision!==fileRevision) return;
    try {filePreview=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes,{stream:next.size>limits.preview});}
    catch {filePreview=Array.from(bytes.subarray(0,Math.floor(limits.preview/3)),b=>b.toString(16).padStart(2,'0')).join(' ');}
    setDocument(source,filePreview);inputInfo();
  } catch {if(revision===fileRevision) notify(tr('文件预览读取失败，可重选文件','File preview failed; choose the file again'));}
}
$('tool-options').addEventListener('submit',event=>{event.preventDefault();execute();});
$('convert-run').addEventListener('click',()=>execute());$('convert-cancel').addEventListener('click',()=>controller.cancel());
$('convert-auto').addEventListener('change',inputChanged);
$('choose-file').addEventListener('click',()=>$('convert-file').click());
$('convert-file').addEventListener('change',()=> {const selected=$('convert-file').files[0];if(selected) void importFile(selected);$('convert-file').value='';});
$('input-mode').addEventListener('change',()=> {
  fileRevision++;controller.invalidate();
  const binary=$('input-mode').value==='file';
  source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(binary),EditorView.editable.of(!binary)])});
  if(!binary) {file=undefined;filePreview='';setDocument(source,'');} else setDocument(source,filePreview);
  inputChanged();
});
$('convert-clear').addEventListener('click',()=> {
  fileRevision++;file=undefined;filePreview='';clearKey();$('input-mode').value='text';
  controller.invalidate();source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(false),EditorView.editable.of(true)])});setDocument(source,'');inputInfo();source.focus();
});
$('input-search').addEventListener('click',()=>openSearchPanel(source));$('output-search').addEventListener('click',()=>openSearchPanel(output));
$('convert-locate').addEventListener('click',()=>{const at=Math.min(lastState.position,source.state.doc.length);source.dispatch({selection:{anchor:at},scrollIntoView:true});source.focus();});
$('convert-copy').addEventListener('click',async()=> {
  const current=result;if(!current?.copyBlob)return;
  try {
    const text=decodeText(new Uint8Array(await current.copyBlob.arrayBuffer()));
    if(result!==current)return;
    await navigator.clipboard.writeText(text);notify(t('common.copied'));
  } catch {notify(tr('剪贴板不可用，请下载完整结果','Clipboard unavailable. Download the full result instead.'));}
});
$('convert-download').addEventListener('click',()=> {
  if(!result)return;const url=URL.createObjectURL(result.blob),link=document.createElement('a');
  link.href=url;link.download=`listools-${tool.id}.${result.extension}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('result-to-input').addEventListener('click',async()=> {
  const current=result;if(!current)return;
  if(current.kind==='bytes') {await importFile(current.blob);return;}
  if(current.blob.size>limits.text) {notify(tr('结果超过可编辑文本 10 MiB，请下载文件后按字节导入','Result exceeds the 10 MiB text limit; download and import as bytes'));return;}
  const text=decodeText(new Uint8Array(await current.blob.arrayBuffer()));
  if(result!==current)return;
  validText(text);fileRevision++;file=undefined;filePreview='';$('input-mode').value='text';
  source.dispatch({effects:editable.reconfigure([EditorState.readOnly.of(false),EditorView.editable.of(true)])});setDocument(source,text);inputChanged();source.focus();
});
window.addEventListener('keydown',event=> {if(event.target.closest?.('.tool-menu'))return;if((event.ctrlKey || event.metaKey)&&event.key==='Enter'){event.preventDefault();execute();}});
window.addEventListener('hashchange',()=>chooseTool(tools.find(item=>item.id===location.hash.slice(1)) || tools[0]));
window.addEventListener('pagehide',()=>{controller.cancel();clearKey();md5.clearKey();});
bindFileDrop(document,{allowMultiple:()=>tool.id==='md5'&&md5.mode==='files',onFiles:files=>md5.importFiles(files),onFile:next=>{if(tool.id==='md5'){notify(t('md5.emptyFileQueue'));return;}void importFile(next);},onActive:active=>{$('convert-drop-overlay').hidden=!active;},onError:notify,multipleMessage:tr('请一次拖入一个文件','Please drop one file at a time')});
function translate() {
  renderCatalog();
  const phrases={'Find':t('common.search'),'Replace':t('common.replace'),'replace':t('common.replace'),'replace all':t('common.replaceAll'),'match case':t('common.matchCase'),'regexp':t('common.regularExpression'),'by word':t('common.wholeWord'),'next':t('common.next'),'previous':t('common.previous'),'all':t('common.selectAll'),'close':t('common.close')};
  for(const [view,compartment,key] of [[source,inputLocale,'common.input'],[output,outputLocale,'common.result']])view.dispatch({effects:compartment.reconfigure([EditorState.phrases.of(phrases),EditorView.contentAttributes.of({'aria-label':t(key),dir:'ltr'})])});
  if(tool.id==='md5') {md5.translate();return;}
  for(const element of document.querySelectorAll('[data-convert]')) element.textContent=label(messages[element.dataset.convert]);
  $('tool-title').textContent=label(tool.name);$('tool-hint').textContent=label(tool.hint);renderOptions();inputInfo();render(lastState);
}
$('app-version').textContent=`v${version}`;
onLanguageChange(translate);translate();chooseTool(tool);
