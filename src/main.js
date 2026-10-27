import {createSourceEditor} from './tools/shared/source-editor.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import { createJSONEditor, jsonQueryLanguage, Mode } from 'vanilla-jsoneditor';
import { parse, stringify } from 'lossless-json';
import { version } from '../package.json';
import { createJsonController } from './tools/json/controller.js';
import { bindFileDrop } from './tools/json/file-drop.js';
import './style.css';
import { t, onLanguageChange, errorText, createNotifier } from './i18n.js';

const $ = (id) => document.getElementById(id);
$('app-version').textContent = `v${version}`;
const sourceEditor=createSourceEditor($('source'));
const source=sourceEditor.element;
const resultButtons = document.querySelectorAll('[data-result]');
const cancelButton=document.createElement('button');cancelButton.id='json-cancel';cancelButton.hidden=true;cancelButton.disabled=true;cancelButton.dataset.i18n='common.cancel';$('compact').after(cancelButton);
const parser = { parse, stringify };
let editor;
let resultText = '', resultVersion=-1;
let errorPosition;
let inputVersion = 0, sourceComposing=false;
let filename = 'formatted.json';
let lastState = { status: 'empty' };
let importedName = '';
let largeResult = false;
let importError,importErrorParams,readVersion=0,readPending=false;
const importStatus=document.createElement('p');importStatus.id='json-import-status';importStatus.className='tool-status';importStatus.setAttribute('role','status');importStatus.hidden=true;source.after(importStatus);
function showImportStatus(key,params){importError=key;importErrorParams=params;importStatus.hidden=!key;importStatus.textContent=key?t(key,params):'';}
function syncPending(){
  const pending=readPending||lastState.status==='pending',visible=pending||lastState.status==='ready';
  cancelButton.disabled=!pending;cancelButton.hidden=!visible;cancelButton.style.visibility=pending?'':'hidden';cancelButton.style.setProperty('display',visible?'inline-flex':'','important');
  for(const button of resultButtons)button.disabled=pending||lastState.status!=='ready';
}
function invalidateRead(){readVersion++;readPending=false;showImportStatus();syncPending();}

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const notify = createNotifier();

function renderMenu(items, { mode }) {
  const labels = { text: t('common.text'), tree: t('common.tree'), 'Expand all': t('common.expand'), 'Collapse all': t('common.collapse'), 'Search (Ctrl+F)': t('common.search') };
  return items.filter((item) => item.text !== 'table' && item.className !== 'jse-copy').map((item) => {
    const label = labels[item.text] || labels[item.title];
    const translated = label ? {
      ...item, icon: undefined, text: label,
      className: `${item.className || ''} lis-menu-label${item.text === 'tree' ? ' jse-last' : ''}`,
      title: label === labels['Search (Ctrl+F)'] ? `${label} (Ctrl / ⌘ + F)` : label
    } : translateMenuItem(item);
    if (mode === Mode.tree && largeResult && ['Expand all', 'Collapse all'].includes(item.title)) {
      return { ...translated, onClick: async () => {
        const currentEditor = editor;
        currentEditor.updateProps({ mode: Mode.text });
        await currentEditor.refresh();
        if (editor !== currentEditor || !resultText) return;
        if (item.title === 'Expand all') currentEditor.expand([], () => true);
        else currentEditor.collapse([], true);
        notify('json.largeTree');
      } };
    }
    return translated;
  });
}

function render(state) {
  const retainResult=state.status==='pending'&&editor&&resultVersion===inputVersion;
  lastState = state;
  syncPending();
  document.querySelector('.output-panel').dataset.status = state.status;
  resultText = '';
  errorPosition = undefined;sourceEditor.markError();
  for (const button of resultButtons) {button.disabled = true;button.style.display=retainResult?'inline-flex':'';}
  $('editor').hidden = !retainResult;
  $('placeholder').hidden = Boolean(retainResult);
  $('error-detail').hidden = true;
  $('locate-error').hidden = true;
  if(!retainResult)$('result-info').textContent = t('json.precision');
  $('result-state').textContent = state.status === 'pending' ? t('common.processing') : t('common.ready');
  $('placeholder').classList.toggle('is-error', state.status === 'error');
  $('placeholder').setAttribute('aria-busy', String(state.status === 'pending'));

  if (state.status === 'ready') {
    try {
      largeResult = state.nodeCount > 2000 || state.text.length > 1000000;
      $('placeholder').hidden = true;
      $('editor').hidden = false;
      if (!editor) {
        editor = createJSONEditor({
          target: $('editor'),
          props: {
            content: { text: state.text }, mode: Mode.text, readOnly: true,
            parser, validationParser: parser, askToFormat: false,
            indentation: Number($('indent').value), tabSize: Number($('indent').value),
            maxDocumentSizeTextMode: 50 * 1024 * 1024,
            queryLanguages: [jsonQueryLanguage],
            ariaLabel: t('json.output'), onRenderMenu: renderMenu, onRenderContextMenu: renderContextMenu,
            onError: (error) => notify('common.editorError', { message: error.message })
          }
        });
      } else {
        editor.updateProps({ indentation: Number($('indent').value), tabSize: Number($('indent').value) });
        if(editor.get().text!==state.text)editor.set({ text: state.text });
      }
      resultText = state.text;resultVersion=inputVersion;
      for (const button of resultButtons) button.disabled = readPending;
      $('input-info').textContent = size(state.inputBytes);
      $('result-info').textContent = `${size(state.outputBytes)} · ${t('common.characters', { count: state.text.length })}`;
      $('result-state').textContent = t('json.success');
    } catch (error) {
      render({ status: 'error', code: 'common.displayError', params: { message: error.message }, message: error.message });
    }
    return;
  }

  if (state.status === 'error') {
    $('placeholder-title').textContent = t('json.failed');
    $('placeholder-description').textContent = state.line ? t('common.location', state) : t('common.retry');
    $('error-detail').textContent = errorText(state);
    $('error-detail').hidden = false;
    $('result-state').textContent = t('common.error');
    errorPosition = state.position;sourceEditor.markError(errorPosition);
    $('locate-error').hidden = errorPosition === undefined;
  } else {
    $('placeholder-title').textContent = state.status === 'pending' ? t('json.parsing') : state.status === 'idle' ? t('json.updated') : t('json.waiting');
    $('placeholder-description').textContent = state.status === 'pending' ? t('json.largeHint') : state.status === 'idle' ? t('json.actionHint') : t('json.viewHint');
  }
  if(state.status==='cancelled')$('placeholder-description').textContent=t('direct.developer.jsonCancelled');
  if (state.status !== 'pending' && editor) {
    void editor.destroy();
    editor = undefined;
  }
}

const controller = createJsonController({
  createWorker: () => new Worker(new URL('./tools/json/worker.js', import.meta.url), { type: 'module' }),
  onState: render
});

function process(action = 'format', wait = 0) {
  invalidateRead();
  controller.process(source.value, { action, indent: Number($('indent').value), wait });
}

function inputChanged() {
  inputVersion += 1;
  invalidateRead();
  $('input-info').textContent = source.value ? t('common.characters', { count: source.value.length }) : t('json.raw');
  if(sourceComposing){controller.cancel();render({status:'idle'});return;}
  if ($('auto-format').checked || !source.value.trim()) process('format', 350);
  else {
    controller.cancel();
    render({ status: 'idle' });
  }
}

source.addEventListener('input', inputChanged);
source.addEventListener('compositionstart',()=>{sourceComposing=true;invalidateRead();controller.cancel();});
source.addEventListener('compositionend',()=>{sourceComposing=false;inputChanged();});
$('format').addEventListener('click', () => process());
$('compact').addEventListener('click', () => process('compact'));
cancelButton.addEventListener('click',()=>{const reading=readPending;invalidateRead();controller.cancel();if(reading)showImportStatus('direct.developer.jsonCancelled');if(!reading||lastState.status==='pending')render({status:'cancelled'});});
$('indent').addEventListener('change', () => process());
$('auto-format').addEventListener('change', () => {
  controller.cancel();
  if ($('auto-format').checked) process();
  else if (!resultText) render({ status: source.value.trim() ? 'idle' : 'empty' });
});
$('clear').addEventListener('click', () => {
  source.value = '';
  $('file').value = '';
  $('file-name').textContent = t('json.supported');
  filename = 'formatted.json';
  importedName = '';
  inputChanged();
  source.focus();
});
$('import').addEventListener('click', () => $('file').click());
async function loadFile(file) {
  if (!file) return;
  const current = ++readVersion;
  readPending=true;showImportStatus('common.processing');syncPending();
  let bytes;
  try {
    try {bytes=await file.arrayBuffer();}
    catch {if(current===readVersion)showImportStatus('office.fileReadError',{name:file.name});return;}
    if(current!==readVersion)return;
    let text;
    try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
    catch(error){showImportStatus(error instanceof TypeError?'diagnostic.InvalidEncoding':'office.fileReadError',{name:file.name});return;}
    readPending=false;inputVersion++;showImportStatus();
    source.value = text;
    filename = `${file.name.replace(/\.[^.]+$/, '')}.formatted.json`;
    importedName = file.name;
    $('file-name').textContent = importedName;
    $('input-info').textContent = t('common.characters', { count: text.length });
    process();
  } finally {
    if(current===readVersion){readPending=false;syncPending();}
    $('file').value = '';
  }
}
$('file').addEventListener('change', () => loadFile($('file').files[0]));
bindFileDrop(document, {
  onFile: loadFile,
  onActive: (active) => { $('file-drop-overlay').hidden = !active; },
  onError: () => notify('common.oneFile')
});
$('locate-error').addEventListener('click', () => {
  source.focus();
  source.setSelectionRange(errorPosition, errorPosition + 1);
  const line = source.value.slice(0, errorPosition).split('\n').length;
  source.scrollTop = Math.max(0, (line - 3) * parseFloat(getComputedStyle(source).lineHeight));
});
$('copy').addEventListener('click', async () => {
  if(lastState.status!=='ready')return;
  try {
    await navigator.clipboard.writeText(resultText);
    notify('common.copiedAll');
  } catch (error) {
    console.warn('Clipboard write failed:', error.name, error.message);
    notify('common.copyFailed');
  }
});
$('download').addEventListener('click', () => {
  if(lastState.status!=='ready')return;
  const url = URL.createObjectURL(new Blob([resultText], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest?.('.tool-menu')) return;
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    process();
  }
});
window.addEventListener('pagehide', () => {const reading=readPending;inputVersion++;invalidateRead();controller.cancel();if(reading)showImportStatus('direct.developer.jsonCancelled');if(lastState.status==='pending')render({status:'cancelled'});});

// The public menu hooks update labels without resetting editor content or its history.
function translateMenuItem(item) {
  const translate = value => {
    if (!value) return value;
    const key = Object.entries({ 'Copy':'common.copy', 'Cut':'common.cut', 'Paste':'common.paste', 'Select all':'common.selectAll', 'Undo':'common.undo', 'Redo':'common.redo', 'Sort':'common.sort', 'Transform':'common.transform', 'Insert':'common.insert', 'Remove':'common.remove', 'Duplicate':'common.duplicate', 'Extract':'common.extract', 'Search':'common.search', 'Format':'json.format', 'Compact':'json.compact', 'Edit key':'common.key', 'Edit':'common.value', 'Value':'common.value', 'Structure':'common.tree' }).find(([name]) => value === name || value.startsWith(name + ' ') || value.startsWith(name + ' ('))?.[1];
    const variant = /compacted|without indentation/.test(value) ? 'json.compact' : /formatted|formatted with indentation/.test(value) ? 'json.format' : undefined;
    const label = key ? t(key) + (variant ? ` · ${t(variant)}` : '') : value;
    return key ? label + (value.match(/\([^)]*Ctrl[^)]*\)/)?.[0] ? ` ${value.match(/\([^)]*Ctrl[^)]*\)/)[0]}` : '') : value;
  };
  return { ...item, ...(item.text ? { text:translate(item.text) } : {}), ...(item.title ? { title:translate(item.title) } : {}), ...(item.main ? { main:translateMenuItem(item.main) } : {}), ...(item.items ? { items:item.items.map(translateMenuItem) } : {}) };
}
// Results are read-only. Keep available context actions and omit disabled edit/type controls.
function renderContextMenu(items) {
  const prune = items => items.filter(item => !item.disabled && !item.main?.disabled)
    .map(item => item.items ? { ...item, items:prune(item.items) } : item)
    .filter(item => !item.items || item.items.some(child => child.type === 'button' || child.type === 'dropdown-button' || child.items?.length));
  return prune(items).map(translateMenuItem);
}
function refreshLabels() {
  cancelButton.textContent=t('common.cancel');
  if(importError)showImportStatus(importError,importErrorParams);
  const state = lastState;
  $('input-info').textContent = source.value ? t('common.characters', { count:source.value.length }) : t('json.raw');
  $('file-name').textContent = importedName || t('json.supported');
  for (const option of $('indent').options) option.textContent = t('json.spaces', { count:Number(option.value) });
  $('result-info').textContent = state.status === 'ready' ? `${size(state.outputBytes)} · ${t('common.characters', { count:state.text.length })}` : t('json.precision');
  $('result-state').textContent = t(state.status === 'ready' ? 'json.success' : state.status === 'error' ? 'common.error' : state.status === 'pending' ? 'common.processing' : 'common.ready');
  $('placeholder-title').textContent = t(state.status === 'error' ? 'json.failed' : state.status === 'pending' ? 'json.parsing' : state.status === 'idle' ? 'json.updated' : 'json.waiting');
  $('placeholder-description').textContent = state.status === 'error' ? state.line ? t('common.location',state) : t('common.retry') : t(state.status === 'pending' ? 'json.largeHint' : state.status === 'idle' ? 'json.actionHint' : 'json.viewHint');
  if(state.status==='cancelled')$('placeholder-description').textContent=t('direct.developer.jsonCancelled');
  if (state.status === 'error') $('error-detail').textContent = errorText(state);
  editor?.updateProps({ ariaLabel:t('json.output'), onRenderMenu:(items, context) => renderMenu(items, context), onRenderContextMenu:items => items.map(translateMenuItem) });
}
onLanguageChange(refreshLabels);
refreshLabels();

registerContentCheck(()=>Boolean(source.value||resultText));
