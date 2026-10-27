import {bindAutoRun} from './tools/shared/auto-run.js';
import {isIncompleteNumber} from './tools/shared/numeric-edit.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import { initTool, $, showError, clearStatus, setStatus, submitForm } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, onLanguageChange } from './i18n.js';
import { formatMoney } from './tools/money/core.js';
import './tools/calculator/style.css';
const outputs=['rounded','grouped','simplified','traditional'],labels={rounded:'numeric',grouped:'grouped',simplified:'simplified',traditional:'traditional'};
initTool('money',`<section class="tool-card"><div class="field"><label for="money-input" data-i18n="money.amount"></label><input id="money-input" placeholder="1234567.89" dir="ltr" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="money-hint"></div><p id="money-hint" class="tool-note" data-i18n="ux.amountHint"></p><div class="tool-actions"><button id="money-run" class="primary" data-i18n="money.convert"></button></div><p id="money-rounding" class="tool-note" role="status"></p>${outputs.map(key=>`<div class="numeric-result-row"><label for="money-${key}" data-i18n="money.${labels[key]}"></label><output id="money-${key}" dir="ltr"></output><button id="copy-${key}" data-copy="money-${key}" data-i18n="money.copy" disabled></button></div>`).join('')}</section>`);
let result;
function render(){for(const key of outputs){$('money-'+key).textContent=result?.[key]||'';$('copy-'+key).disabled=!result;$('money-'+key).closest('.numeric-result-row').hidden=!result;}if($('money-empty'))$('money-empty').hidden=Boolean(result);if($('money-other-formats'))$('money-other-formats').hidden=!result;$('money-rounding').textContent=result?.didRound?t('money.roundedNotice',{original:result.original,rounded:result.rounded}):'';}
function run(explicit=false){clearStatus();try{result=formatMoney($('money-input').value);}catch(error){result=undefined;showError(error,{field:'money-input',focus:explicit});}render();}
$('money-run').addEventListener('click',()=>run(true));$('money-input').addEventListener('input',()=>{const had=Boolean(result);result=undefined;clearStatus({keepStale:true});render();if(had)setStatus('ux.stale');});for(const key of outputs)$('copy-'+key).addEventListener('click',()=>{if(result)copyText(result[key]);});onLanguageChange(render);render();

registerContentCheck(()=>Boolean($('money-input').value||result));

const moneyCard=$('money-input').closest('section'),moneyInput=document.createElement('div'),moneyResults=document.createElement('section');moneyInput.className='money-input';moneyResults.className='money-results';
moneyCard.className='tool-card money-workspace';moneyInput.append(...moneyCard.childNodes);moneyCard.append(moneyInput,moneyResults);moneyResults.append($('money-rounding'),...moneyInput.querySelectorAll('.numeric-result-row'));

const otherMoney=document.createElement('details');otherMoney.id='money-other-formats';otherMoney.innerHTML='<summary data-i18n="ux.otherFormats"></summary>';$('money-simplified').closest('.numeric-result-row').classList.add('money-primary');moneyResults.prepend($('money-simplified').closest('.numeric-result-row'),$('money-rounding'));$('money-simplified').closest('.numeric-result-row').after($('money-rounded').closest('.numeric-result-row'));moneyResults.append(otherMoney);otherMoney.append($('money-grouped').closest('.numeric-result-row'),$('money-traditional').closest('.numeric-result-row'));otherMoney.querySelector('summary').textContent=t('ux.otherFormats');submitForm(moneyInput,$('money-run'));

const moneyEmpty=document.createElement('p');moneyEmpty.id='money-empty';moneyEmpty.className='tool-note';moneyEmpty.dataset.i18n='direct.daily.moneyEmpty';moneyEmpty.textContent=t('direct.daily.moneyEmpty');moneyResults.prepend(moneyEmpty);render();

const moneyAutoRun=bindAutoRun(moneyInput,()=>run(false),{button:$('money-run'),canRun:()=>Boolean($('money-input').value.trim())&&!isIncompleteNumber($('money-input').value)});
$('money-input').addEventListener('blur',event=>{moneyAutoRun.cancel();if(event.relatedTarget!==$('money-run')&&!$('money-run').matches(':active'))run(false);});
