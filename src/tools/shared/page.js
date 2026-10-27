import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { createTextState } from '../convert/editor.js';
import { t, translateDOM, language, onLanguageChange } from '../../i18n.js';
import { pages } from './navigation.js';
import { version } from '../../../package.json';
import '../../style.css';
import '../../tools-style.css';

export const tr=(zh,en)=>language().startsWith('zh')?zh:en;
let notificationTimer;
export function notify(message) {
  const element=document.getElementById('notification');
  clearTimeout(notificationTimer);element.textContent=message;element.hidden=false;
  notificationTimer=setTimeout(()=>{element.hidden=true;element.textContent='';},3500);
}
export async function copyText(text) {
  try {await navigator.clipboard.writeText(text);notify(t('common.copied'));return true;}
  catch {notify(t('common.copyFailed'));return false;}
}
export function downloadText(text,name,type='text/plain;charset=utf-8') {
  const blob=text instanceof Blob?text:new Blob([text],{type});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function localize(root=document) {
  translateDOM(root);
  for(const output of root.querySelectorAll('output,.tool-output'))output.dataset.empty=t('office.noResult');
  for(const output of root.querySelectorAll('textarea[readonly]'))output.placeholder=t('office.noResult');
  for(const element of root.querySelectorAll('[data-zh][data-en]')) element.textContent=tr(element.dataset.zh,element.dataset.en);
  for(const element of root.querySelectorAll('[data-placeholder-zh][data-placeholder-en]')) element.placeholder=tr(element.dataset.placeholderZh,element.dataset.placeholderEn);
}
export function mountTool(id) {
  const page=pages.find(page=>page.id===id);
  const refresh=()=>{document.title=`${t(page.key)} · LisTools`;localize();};
  document.getElementById('app-version').textContent=`v${version}`;
  onLanguageChange(refresh);refresh();
}
export function createEditor(parent,{doc='',onChange=()=>{},readOnly=false,lineWrapping=true}={}) {
  const locale=new Compartment();
  const view=new EditorView({parent,state:createTextState({doc,extensions:[locale.of([]),
    lineNumbers(),search(),keymap.of([...defaultKeymap,...searchKeymap,...(readOnly?[]:historyKeymap)]),
    ...(!readOnly?[history()]:[]),EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly),
    ...(lineWrapping?[EditorView.lineWrapping]:[]),EditorView.contentAttributes.of({spellcheck:'false',autocorrect:'off',autocapitalize:'off','aria-label':t(readOnly?'common.result':'common.input')}),
    EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString(),update);})
  ]})});
  function refresh(){
    const phrases=Object.fromEntries(Object.entries({Find:'search',Replace:'replace',replace:'replace','replace all':'replaceAll','match case':'matchCase',regexp:'regularExpression','by word':'wholeWord',next:'next',previous:'previous',all:'selectAll',close:'close'}).map(([name,key])=>[name,t('common.'+key)]));
    view.dispatch({effects:locale.reconfigure([EditorState.phrases.of(phrases),EditorView.contentAttributes.of({'aria-label':t(readOnly?'common.result':'common.input'),dir:'ltr'})])});
  }
  onLanguageChange(refresh);refresh();return view;
}

export {revealSection} from './workspace.js';
