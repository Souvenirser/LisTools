import { initTool, $, showError, clearStatus } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, onLanguageChange } from './i18n.js';
import { formatMoney } from './tools/money/core.js';
import './tools/calculator/style.css';
const outputs=['rounded','grouped','simplified','traditional'],labels={rounded:'numeric',grouped:'grouped',simplified:'simplified',traditional:'traditional'};
initTool('money',`<section class="tool-card"><div class="field"><label for="money-input" data-i18n="money.amount"></label><input id="money-input" value="1234567.89" dir="ltr" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="money-hint"></div><p id="money-hint" class="tool-note" data-i18n="money.hint"></p><div class="tool-actions"><button id="money-run" class="primary" data-i18n="money.convert"></button></div><p id="money-rounding" class="tool-note" role="status"></p>${outputs.map(key=>`<div class="numeric-result-row"><label for="money-${key}" data-i18n="money.${labels[key]}"></label><output id="money-${key}" dir="ltr"></output><button id="copy-${key}" data-i18n="money.copy" disabled></button></div>`).join('')}</section>`);
let result;
function render(){for(const key of outputs){$('money-'+key).textContent=result?.[key]||'';$('copy-'+key).disabled=!result;}$('money-rounding').textContent=result?.didRound?t('money.roundedNotice',{original:result.original,rounded:result.rounded}):'';}
function run(){clearStatus();try{result=formatMoney($('money-input').value);}catch(error){result=undefined;showError(error);}render();}
$('money-run').addEventListener('click',run);$('money-input').addEventListener('keydown',event=>{if(event.key==='Enter')run();});$('money-input').addEventListener('input',()=>{result=undefined;clearStatus();render();});for(const key of outputs)$('copy-'+key).addEventListener('click',()=>{if(result)copyText(result[key]);});onLanguageChange(render);run();
