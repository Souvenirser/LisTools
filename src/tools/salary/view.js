import {t} from '../../i18n-runtime.js';
import {snapshot} from './core.js';
import {salaryStore} from './store.js';
let cached;
export function readSalarySnapshot(){
 const config=salaryStore.read();try{const result=snapshot(config,Date.now(),cached);cached=result.plan;return {config,result};}catch(error){return {config,result:{state:'error',earned:null,today:null,error:error.code?.startsWith('salary.')?error:undefined}};}
}
export const money=(value,masked)=>value===null||value===undefined?'—':masked?'¥••••':'¥'+value;
export function translateMini(root){for(const node of root.querySelectorAll('[data-i18n]')){const value=t(node.dataset.i18n);if(node.textContent!==value)node.textContent=value;}}
export function updateMini(root,{config,result}=readSalarySnapshot()){
 translateMini(root);for(const [name,value]of [['earned',result.earned],['today',result.today]]){const text=money(value,config?.masked);for(const node of root.querySelectorAll('[data-salary-'+name+']'))if(node.textContent!==text)node.textContent=text;}
 for(const node of root.querySelectorAll('[data-salary-state]')){node.textContent=t('salary.state_'+result.state);node.dataset.state=result.state;}
 const floating=root.classList.contains('salary-mini-floating');
 const mask=root.querySelector('[data-salary-mask]');if(mask){const label=t(config?.masked?'salary.showAmounts':'salary.mask');mask.textContent=floating?t(config?.masked?'salary.showShort':'salary.hideShort'):label;mask.title=label;mask.setAttribute('aria-label',label);mask.setAttribute('aria-pressed',String(Boolean(config?.masked)));}
 if(floating){const close=root.querySelector('[data-salary-close]');close.title=t('salary.pipClose');close.setAttribute('aria-label',t('salary.pipClose'));}
}
export function toggleMask(){
 const masked=!salaryStore.read()?.masked;
 return salaryStore.updateDisplay(()=>({masked}));
}
export function createMiniView(doc,{compact=false,floating=false,onClose=()=>{}}={}){
 const root=doc.createElement('section');root.className='salary-mini'+(compact?' salary-mini-compact':'')+(floating?' salary-mini-floating':'');root.innerHTML='<div class="salary-mini-value"><span data-i18n="salary.monthEarned"></span><strong data-salary-earned dir="ltr" aria-live="off">—</strong></div><div class="salary-mini-today"><span data-i18n="salary.today"></span><span data-salary-today dir="ltr" aria-live="off">—</span></div><span data-salary-state></span><div class="salary-mini-controls"><button type="button" data-salary-mask></button><button type="button" data-salary-close data-i18n="common.close"></button></div>';
 const notice=doc.createElement('p');notice.className='salary-mini-display-notice';notice.setAttribute('role','status');notice.hidden=true;root.append(notice);
 if(floating){const close=root.querySelector('[data-salary-close]');close.removeAttribute('data-i18n');close.innerHTML='<span aria-hidden="true">×</span>';}
 root.querySelector('[data-salary-mask]').onclick=async()=>{
  notice.hidden=(await toggleMask())?.saved!==false;
  if(!notice.hidden){notice.dataset.i18n='salary.localDisplayOnly';notice.textContent=t(notice.dataset.i18n);}
 };
 root.querySelector('[data-salary-close]').onclick=onClose;updateMini(root);return root;
}
