import {Compartment,StateEffect} from '@codemirror/state';
import {EditorView,Decoration,placeholder} from '@codemirror/view';
import {json} from '@codemirror/lang-json';
import {tags} from '@lezer/highlight';
const jsonColors=HighlightStyle.define([{tag:tags.string,color:'var(--green-11)'},{tag:tags.number,color:'var(--amber-11)'},{tag:tags.bool,color:'var(--blue-11)'},{tag:tags.null,color:'var(--red-11)'},{tag:tags.propertyName,color:'var(--text)'},{tag:[tags.punctuation,tags.bracket],color:'var(--muted)'}]);
import {syntaxHighlighting,HighlightStyle,foldGutter} from '@codemirror/language';
import {createEditor} from './page.js';
import {t,onLanguageChange} from '../../i18n-runtime.js';

// Retain the existing source interface without a second full copy of large documents.
export function createSourceEditor(textarea){
 const host=document.createElement('div');host.id=textarea.id;host.className='json-source-editor';host.dir='ltr';textarea.replaceWith(host);
 let setting=false;const error=new Compartment(),hint=new Compartment();
 const view=createEditor(host,{lineWrapping:false,onChange(){if(!setting)host.dispatchEvent(new Event('input',{bubbles:true}));}});
 view.dispatch({effects:StateEffect.appendConfig.of([json(),foldGutter(),syntaxHighlighting(jsonColors),error.of([]),hint.of(placeholder(t('json.sourceHint')))])});
 host.addEventListener('input',event=>{if(event.target!==host)event.stopImmediatePropagation();});
 Object.defineProperties(host,{value:{get:()=>view.state.doc.toString(),set:value=>{setting=true;try{view.dispatch({changes:{from:0,to:view.state.doc.length,insert:String(value).replace(/\r\n?/g,'\n')}});}finally{setting=false;}}},selectionStart:{get:()=>view.state.selection.main.from},selectionEnd:{get:()=>view.state.selection.main.to},scrollTop:{get:()=>view.scrollDOM.scrollTop,set:value=>{view.scrollDOM.scrollTop=value;}}});
 host.focus=()=>view.focus();host.setSelectionRange=(from,to=from)=>view.dispatch({selection:{anchor:Math.min(from,view.state.doc.length),head:Math.min(to,view.state.doc.length)},effects:EditorView.scrollIntoView(Math.min(from,view.state.doc.length),{y:'center'})});
 onLanguageChange(()=>view.dispatch({effects:hint.reconfigure(placeholder(t('json.sourceHint')))}));
 return {element:host,view,markError(position){const decorations=Number.isInteger(position)?Decoration.set([Decoration.line({class:'json-error-line'}).range(view.state.doc.lineAt(Math.max(0,Math.min(position,view.state.doc.length))).from)]):Decoration.none;view.dispatch({effects:error.reconfigure(EditorView.decorations.of(decorations))});}};
}
