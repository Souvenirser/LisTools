import {t,onLanguageChange,translateDOM} from '../../i18n.js';
import {$,field,select,check,note,financialDraft} from './ui.js';
import {deductionDraft} from './tax-input.js';

// The assistant edits a draft. Only Apply replaces the effective monthly total.
export function mountDeductionAssistant(prefix,target,onApply){
 const dialog=document.createElement('dialog');dialog.id=prefix+'-assistant';dialog.className='tax-deduction-assistant';dialog.setAttribute('aria-labelledby',prefix+'-assistant-title');
 dialog.innerHTML=`<div class="tax-dialog-heading"><h1 id="${prefix}-assistant-title" data-i18n="taxEase.assistant"></h1><button type="button" id="${prefix}-assistant-close" data-i18n="common.close"></button></div>${note('taxEase.assistantHint')}<div class="payroll-fields">${field(prefix+'-children','taxEase.children','0','number','min="0" step="1"')}${select(prefix+'-childShare','taxEase.share',[['1','taxEase.fullShare'],['.5','taxEase.halfShare']],'1')}${field(prefix+'-infant','taxEase.infant','0','number','min="0" step="1"')}${select(prefix+'-infantShare','taxEase.share',[['1','taxEase.fullShare'],['.5','taxEase.halfShare']],'1')}${select(prefix+'-elderly','taxEase.elderly',[['none','taxEase.none'],['only','taxEase.onlyChild'],['shared','taxEase.sharedElderly']],'none')}${field(prefix+'-elderlyShare','taxEase.elderlyShare','0')}</div>${select(prefix+'-housingChoice','taxEase.housing',[['none','taxEase.none'],['rent1500','taxEase.rent1500'],['rent1100','taxEase.rent1100'],['rent800','taxEase.rent800'],['mortgage1000','taxEase.mortgage1000'],['mortgage500','taxEase.mortgage500']],'none')}${check(prefix+'-education','taxEase.education')}${note('taxEase.housingHint')}${note('taxEase.annualOnly')}<p id="${prefix}-assistant-error" role="alert" hidden></p><p class="tax-assistant-total"><span data-i18n="taxEase.monthlyDeduction"></span> <output id="${prefix}-assistant-total" dir="ltr">0.00</output></p><button type="button" class="primary" id="${prefix}-assistant-apply" data-i18n="taxEase.applyDeduction"></button><details><summary data-i18n="taxEase.sources"></summary><a href="https://fgk.chinatax.gov.cn/zcfgk/c102440/c5213594/content.html" target="_blank" rel="noopener" data-i18n="taxEase.sourceUpdated"></a><br><a href="https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html" target="_blank" rel="noopener" data-i18n="taxEase.sourceBase"></a></details>`;
 document.body.append(dialog);let trigger,error;
 const get=()=>Object.fromEntries(['children','childShare','infant','infantShare','elderly','elderlyShare','housing','education'].map(k=>[k,k==='education'?$(prefix+'-'+k).checked:$(prefix+'-'+(k==='housing'?'housingChoice':k)).value]));
 function refresh(){
  $(prefix+'-elderlyShare').closest('.field').hidden=$(prefix+'-elderly').value!=='shared';
  try{const result=deductionDraft(get());$(prefix+'-assistant-total').value=result.total;$(prefix+'-assistant-error').hidden=true;error=undefined;}
  catch(e){error=e;$(prefix+'-assistant-error').hidden=false;$(prefix+'-assistant-error').textContent=t(e.code);$(prefix+'-assistant-total').value='—';}
 }
 dialog.addEventListener('input',refresh);dialog.addEventListener('change',refresh);
 $(prefix+'-assistant-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>trigger?.focus({preventScroll:true}));
 $(prefix+'-assistant-apply').onclick=()=>{refresh();if(error){$(prefix+'-'+error.field)?.focus();return;}const result=deductionDraft(get());$(target).value=result.total;onApply(result,get());dialog.close();};
 onLanguageChange(()=>{translateDOM(dialog);refresh();});translateDOM(dialog);refresh();const initial=financialDraft(dialog);
 return {open(button){trigger=button;dialog.showModal();refresh();},hasDraft:()=>financialDraft(dialog)!==initial};
}
