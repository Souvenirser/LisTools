import { t, translateDOM, onLanguageChange } from '../../i18n.js';
import { mountTool } from './page.js';
import { createConversionController } from '../convert/controller.js';
import '../../office-style.css';

export const $=id=>document.getElementById(id);
export function initTool(id,markup){
  $('tool-root').innerHTML=`<section class="tool-heading"><h1 data-i18n="${id}.name"></h1><p class="tool-note" data-i18n="${id}.description"></p></section><p id="tool-status" class="tool-status" role="status" aria-live="polite" hidden></p>${markup}`;
  mountTool(id);
  const refresh=()=>translateDOM($('tool-root'));
  onLanguageChange(refresh);refresh();
}
let status;
export function setStatus(key,params={}){
  status={key,params};
  const element=$('tool-status');
  if(element){element.hidden=false;element.textContent=t(key,params);element.classList.remove('is-error');}
}
export function clearStatus(){status=undefined;const element=$('tool-status');if(element){element.hidden=true;element.textContent='';}}
export function showError(error={}){
  const key=error.code && /^(?:office|calculator|dates|qr|images|text|units|money|pdf|draw|timer)\./.test(error.code)?error.code:error.code==='TaskTimeout'?'office.timeout':'office.error';
  setStatus(key,error.params);$('tool-status')?.classList.add('is-error');
}
onLanguageChange(()=>{if(status){const element=$('tool-status');if(element)element.textContent=t(status.key,status.params);}});
export function taskRunner(createWorker,{onResult=()=>{},onState=()=>{},onEvent=()=>{},timeoutMs=30000}={}){
  const controller=createConversionController({createWorker,timeoutMs,onEvent,onState:state=>{
    if(state.status==='pending')setStatus('common.processing');
    else if(state.status==='error')showError(state);
    else if(state.status==='cancelled')setStatus('office.cancelled');
    else clearStatus();
    if(state.status==='ready')onResult(state);
    onState(state);
  }});
  addEventListener('pagehide',()=>controller.cancel(),{once:true});
  return controller;
}
