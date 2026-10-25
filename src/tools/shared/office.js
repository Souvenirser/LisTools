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
let status,fieldError;
function clearFieldError(){
 if(!fieldError)return;
 const {field,node}=fieldError;field.removeAttribute('aria-invalid');
 const description=(field.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==node.id).join(' ');
 if(description)field.setAttribute('aria-describedby',description);else field.removeAttribute('aria-describedby');
 field.removeEventListener('input',clearFieldError);node.remove();fieldError=undefined;if($('tool-status'))delete $('tool-status').dataset.field;
}
export function setStatus(key,params={},withName=false){
  clearFieldError();
  status={key,params,withName};
  const element=$('tool-status');
  if(element){element.dataset.taskState='notice';element.hidden=false;element.textContent=(withName&&params.name&&key!=='office.fileReadError'?`${params.name} · `:'')+t(key,params);element.classList.remove('is-error');}
}
export function clearStatus({keepStale=false}={}){if(keepStale&&status?.key==='ux.stale')return;clearFieldError();status=undefined;const element=$('tool-status');if(element){element.dataset.taskState='idle';element.hidden=true;element.textContent='';}}
export function showError(error={},{field,focus=false}={}){
  const key=error.code && /^(?:office|calculator|dates|qr|images|text|units|money|pdf|draw|timer)\./.test(error.code)?error.code:error.code==='TaskTimeout'?'office.timeout':'office.error';
  setStatus(key,error.params,true);$('tool-status')?.classList.add('is-error');if($('tool-status'))$('tool-status').dataset.taskState='error';
  field=typeof field==='string'?$(field):field;
  if(field){
    const node=document.createElement('p');node.id=`${field.id}-error`;node.className='field-error';node.textContent=t(key,error.params);field.after(node);
    field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),node.id].filter(Boolean).join(' '));
    fieldError={field,node,key,params:error.params};field.addEventListener('input',clearFieldError);if($('tool-status'))$('tool-status').dataset.field=field.id;
    if(focus)field.focus();
  }
}
onLanguageChange(()=>{if(status){const element=$('tool-status');if(element)element.textContent=(status.withName&&status.params.name&&status.key!=='office.fileReadError'?`${status.params.name} · `:'')+t(status.key,status.params);}if(fieldError)fieldError.node.textContent=t(fieldError.key,fieldError.params);});
export function taskRunner(createWorker,{onResult=()=>{},onState=()=>{},onEvent=()=>{},isEmpty=()=>false,timeoutMs=30000}={}){
  let pending=false,hadResult=false;
  const controller=createConversionController({createWorker,timeoutMs,onEvent,onState:state=>{
    pending=state.status==='pending';
    if(state.status==='pending')setStatus('common.processing');
    else if(state.status==='error'){if(isEmpty(state))setStatus(state.code,state.params);else showError(state);}
    else if(state.status==='cancelled')setStatus('office.cancelled');
    else if(state.status==='idle'&&hadResult){setStatus('ux.stale');hadResult=false;}else clearStatus({keepStale:state.status==='idle'});
    if(state.status==='ready'){hadResult=true;onResult(state);}
    onState(state);
    if($('tool-status'))$('tool-status').dataset.taskState=state.status==='error'&&isEmpty(state)?'empty':state.status;
  }});
  addEventListener('pagehide',()=>{if(pending)controller.cancel();});
  return controller;
}

export function submitForm(container,primary){
 const form=document.createElement('form');form.className='task-form';form.style.display='contents';form.append(...container.childNodes);container.append(form);
 for(const button of form.querySelectorAll('button'))button.type=button===primary?'submit':'button';
 form.addEventListener('submit',event=>{event.preventDefault();if(!event.submitter)primary.click();});return form;
}
