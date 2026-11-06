// Same-origin bridge: tool modules keep their existing document and lifecycle.
import {hasUserContent} from './content-state.js';
import {setLanguage} from '../../i18n-runtime.js';

export const embedded=window.parent!==window&&window.frameElement?.hasAttribute('data-workspace-frame');

export function connectWorkspace(){
 if(!embedded)return;
 const owner=parent.LisToolsWorkspace,frame=window.frameElement;
 const replace=history.replaceState.bind(history);
 let applying=false;
 function changed(push){if(!applying)queueMicrotask(()=>owner?.route(frame,location.href,push));}
 history.pushState=(state,unused,url)=>{replace(state,unused,url);changed(true);};
 history.replaceState=(state,unused,url)=>{replace(state,unused,url);changed(false);};
 addEventListener('hashchange',()=>changed(false));
 window.LisToolsTool={
  hasContent:hasUserContent,
  setLanguage,
  navigate(url){applying=true;const before=location.href;replace(null,'',url);dispatchEvent(new HashChangeEvent('hashchange',{oldURL:before,newURL:location.href}));applying=false;return location.href;},
  suspend(persisted){dispatchEvent(new PageTransitionEvent('pagehide',{persisted}));},
  resume(){dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));dispatchEvent(new Event('resize'));}
 };
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');
  if(!anchor||event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||anchor.download||anchor.target==='_blank')return;
  if(owner?.navigate(anchor.href,{source:frame})){event.preventDefault();}
 });
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
   event.preventDefault();event.stopImmediatePropagation();owner?.search(frame);
  }
 },true);
 new MutationObserver(()=>owner?.focus(frame,document.body.classList.contains('workspace-focused'))).observe(document.body,{attributes:true,attributeFilter:['class']});
}
