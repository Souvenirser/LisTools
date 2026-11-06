import {pages,currentTarget} from './tools/shared/navigation.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import {language,onLanguageChange} from './i18n-runtime.js';
import {restoreWorkspaceNavigation} from './i18n.js';
import './workspace-host.css';

// The shell belongs to this document. Each tool retains its original module scope.
export async function mountWorkspace(){
 document.body.className='tool-page workbench-shell workspace-host';
 document.querySelector('title')?.removeAttribute('data-i18n');
 delete document.body.dataset.layout;
 const main=document.querySelector('.app-layout>main');
 main.replaceChildren();
 const notice=document.createElement('div');notice.className='workspace-navigation-status';notice.hidden=true;notice.setAttribute('role','status');
 const message=document.createElement('span'),retry=document.createElement('button');retry.type='button';notice.append(message,retry);main.append(notice);
 const cache=new Map();let active,pending,sequence=0,disposed=false,noticeFailed=false;
 const identify=value=>{try{const url=new URL(value,location.href);if(url.pathname.endsWith('/'))url.pathname+='index.html';return url.origin===location.origin&&pages.some(page=>page.file.split('#')[0]===url.pathname.split('/').pop())?url:undefined;}catch{return undefined;}};
 const content=record=>{try{return Boolean(record?.frame.contentWindow.LisToolsTool?.hasContent());}catch{return false;}};
 function updateRoute(url,push=false){if(location.href!==url.href)history[push?'pushState':'replaceState'](null,'',url);dispatchEvent(new Event('listools:workspace-route'));}
 function status(failed){noticeFailed=failed;const labels=window.LisToolsBootCatalog?.labels[language()]||window.LisToolsBootCatalog?.labels.en;message.textContent=labels?.[failed?'loadFailed':'stillLoading']||'Loading…';retry.textContent=labels?.reload||'Reload';notice.hidden=false;retry.hidden=!failed;}
 function discard(record){if(!record)return;clearTimeout(record.slow);clearTimeout(record.timeout);try{record.frame.contentWindow?.LisToolsTool?.suspend(false);}catch{/* A failed navigation may be a browser error document. */}record.frame.remove();}
 function cancelPending(){if(!pending)return;discard(pending);pending=undefined;notice.hidden=true;}
 function reveal(record,push){
  if(pending!==record)return;
  clearTimeout(record.slow);clearTimeout(record.timeout);
  const old=active;pending=undefined;active=record;
  record.url=new URL(record.frame.contentWindow.location.href);
  // Keep protected history drafts in memory; sensitive tools still run their leave cleanup.
  if(old){old.frame.removeAttribute('data-workspace-active');if(content(old)&&!['speedtest.html','password.html'].includes(old.url.pathname.split('/').pop())){old.frame.contentWindow.LisToolsTool?.suspend(true);old.frame.hidden=true;cache.set(old.url.pathname,old);}else discard(old);}
  record.frame.hidden=false;record.frame.removeAttribute('inert');record.frame.setAttribute('data-workspace-active','');
  record.frame.contentWindow.LisToolsTool?.resume();
  document.title=record.frame.contentDocument.title;record.frame.title=document.title;
  document.body.classList.toggle('workspace-focused',record.frame.contentDocument.body.classList.contains('workspace-focused'));
  notice.hidden=true;updateRoute(record.url,push);window.LisToolsBoot?.ready();
 }
 function navigate(value,{history=false,source}={}){
  const url=identify(value);if(!url||disposed||source&&source!==active?.frame)return false;
  const same=active&&url.pathname===active.url.pathname;
  if(!history&&!same&&content(active)){window.open(url.href,'_blank','noopener');return true;}
  if(same){cancelPending();if(currentTarget(url.pathname,url.hash)===currentTarget(active.url.pathname,active.url.hash)&&url.hash===active.url.hash)return true;
   active.frame.contentWindow.LisToolsTool.navigate(url.href);queueMicrotask(()=>{if(!active)return;active.url=new URL(active.frame.contentWindow.location.href);document.title=active.frame.contentDocument.title;updateRoute(active.url,!history);});return true;}
  if(pending?.url.href===url.href)return true;
  cancelPending();const frame=document.createElement('iframe');frame.dataset.workspaceFrame=String(++sequence);frame.setAttribute('inert','');frame.title=pages.find(page=>page.file.split('#')[0]===url.pathname.split('/').pop())?.en||'LisTools';
  let record=cache.get(url.pathname);if(record){cache.delete(url.pathname);record.url=url;record.frame.contentWindow.LisToolsTool.navigate(url.href);pending=record;reveal(record,!history);return true;}
  record={frame,url,push:!history};pending=record;frame.src=url.href;main.insertBefore(frame,notice);
  record.slow=setTimeout(()=>{if(pending===record)status(false);},3000);
  record.timeout=setTimeout(()=>failed(frame),15000);
  frame.addEventListener('error',()=>failed(frame),{once:true});
  frame.addEventListener('load',()=>{try{if(!frame.contentDocument||frame.contentDocument.documentElement.dataset.uiState==='failed')failed(frame);}catch{failed(frame);}},{once:true});return true;
 }
 function failed(frame){if(pending?.frame!==frame)return;const url=pending.url;cancelPending();status(true);window.LisToolsBoot?.ready();retry.onclick=()=>navigate(url.href,{history:true});}
 window.LisToolsWorkspace={navigate,
  ready(frame){const record=pending;if(record?.frame!==frame)return;void frame.contentWindow.LisToolsTool.setLanguage(language()).then(()=>{if(pending===record)reveal(record,record.push);}).catch(()=>failed(frame));},
  failed,
  route(frame,value,push){if(frame!==active?.frame)return;const url=identify(value);if(!url)return;active.url=url;document.title=frame.contentDocument.title;updateRoute(url,push);},
  search(frame){if(frame===active?.frame)document.querySelector('.header-search')?.click();},
  focus(frame,value){if(frame===active?.frame)document.body.classList.toggle('workspace-focused',value);}
 };
 registerContentCheck(()=>content(active));
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href]');if(!anchor||event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||anchor.target==='_blank'||anchor.download)return;
  if(navigate(anchor.href))event.preventDefault();
 });
 addEventListener('popstate',()=>navigate(location.href,{history:true}));
 addEventListener('hashchange',()=>{if(active?.url.href!==location.href)navigate(location.href,{history:true});});
 onLanguageChange(()=>{for(const record of [active,pending,...cache.values()])void record?.frame.contentWindow.LisToolsTool?.setLanguage(language()).then(()=>{if(record===active){document.title=record.frame.contentDocument.title;record.frame.title=document.title;}}).catch(()=>{});if(!notice.hidden)status(noticeFailed);});
 addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;cancelPending();for(const record of [active,...cache.values()])record?.frame.contentWindow.LisToolsTool?.suspend(false);}});
 addEventListener('pageshow',event=>{if(event.persisted)active?.frame.contentWindow.LisToolsTool?.resume();});
 navigate(location.href,{history:true});restoreWorkspaceNavigation();
}
