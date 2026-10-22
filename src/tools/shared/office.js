import { t, translateDOM, onLanguageChange } from '../../i18n.js';
import { mountTool } from './page.js';
import { createConversionController } from '../convert/controller.js';
import '../../office-style.css';

export const $=id=>document.getElementById(id);
export function initTool(id,markup,{statusTarget}={}){
  $('tool-root').innerHTML=`<section class="tool-heading"><h1 data-i18n="${id}.name"></h1><p class="tool-note" data-i18n="${id}.description"></p></section><p id="tool-status" class="tool-status" role="status" aria-live="polite" hidden></p>${markup}`;
  if(statusTarget)$(statusTarget)?.append($('tool-status'));
  mountTool(id);
  const refresh=()=>translateDOM($('tool-root'));
  onLanguageChange(refresh);refresh();
}
let status;
export function setStatus(key,params={},withName=false){
  status={key,params,withName};
  const element=$('tool-status');
  if(element){element.dataset.taskState='notice';element.hidden=false;element.textContent=(withName&&params.name&&key!=='office.fileReadError'?`${params.name} · `:'')+t(key,params);element.classList.remove('is-error');}
}
export function clearStatus(){status=undefined;const element=$('tool-status');if(element){element.dataset.taskState='idle';element.hidden=true;element.textContent='';}}
export function showError(error={}){
  const key=error.code && /^(?:office|calculator|dates|qr|images|text|units|money|pdf|draw|timer)\./.test(error.code)?error.code:error.code==='TaskTimeout'?'office.timeout':'office.error';
  setStatus(key,error.params,true);$('tool-status')?.classList.add('is-error');if($('tool-status'))$('tool-status').dataset.taskState='error';
}
onLanguageChange(()=>{if(status){const element=$('tool-status');if(element)element.textContent=(status.withName&&status.params.name&&status.key!=='office.fileReadError'?`${status.params.name} · `:'')+t(status.key,status.params);}});
export function taskRunner(createWorker,{onResult=()=>{},onState=()=>{},onEvent=()=>{},timeoutMs=30000}={}){
  const controller=createConversionController({createWorker,timeoutMs,onEvent,onState:state=>{
    if(state.status==='pending')setStatus('common.processing');
    else if(state.status==='error')showError(state);
    else if(state.status==='cancelled')setStatus('office.cancelled');
    else clearStatus();
    if(state.status==='ready')onResult(state);
    onState(state);
    if($('tool-status'))$('tool-status').dataset.taskState=state.status;
  }});
  addEventListener('pagehide',()=>controller.cancel());
  return controller;
}
