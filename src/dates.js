import { Temporal } from 'temporal-polyfill/implementation';
import { initTool, $, showError, clearStatus } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, onLanguageChange } from './i18n.js';
import { difference, shiftDate, businessDays, dateMilestone, parseDateList } from './tools/dates/core.js';
import './tools/calculator/style.css';
const field=(id,key,type='date')=>`<div class="field"><label for="${id}" data-i18n="dates.${key}"></label><input id="${id}" type="${type}" dir="ltr"></div>`;
const actions=id=>`<div class="tool-actions"><button id="${id}-run" class="primary" data-i18n="dates.calculate"></button><button id="${id}-copy" data-i18n="dates.copy" disabled></button></div><output id="${id}-output" class="tool-output" aria-live="polite"></output>`;
initTool('dates',`<div class="tool-grid">
<section class="tool-card"><h2 data-i18n="dates.difference"></h2><div class="tool-fields">${field('date-start','start')}${field('date-end','end')}</div><label class="check-label"><input id="date-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="tool-actions"><button id="date-today-start" data-i18n="dates.todayStart"></button><button id="date-today-end" data-i18n="dates.todayEnd"></button></div><p class="tool-note" data-i18n="dates.countdownHint"></p>${actions('difference')}</section>
<section class="tool-card"><h2 data-i18n="dates.shift"></h2><div class="tool-fields">${field('date-base','base')}${field('date-amount','amount','number')}<div class="field"><label for="date-unit" data-i18n="dates.unit"></label><select id="date-unit">${['day','week','month','year'].map(unit=>`<option value="${unit}s" data-i18n="dates.${unit}Unit"></option>`).join('')}</select></div></div><p class="tool-note" data-i18n="dates.constrain"></p>${actions('shift')}</section>
<section class="tool-card"><h2 data-i18n="dates.milestone"></h2><div class="tool-fields">${field('date-origin','origin')}${field('date-reference','reference')}</div>${actions('milestone')}</section>
<section class="tool-card"><h2 data-i18n="dates.workdays"></h2><div class="tool-fields">${field('work-start','start')}${field('work-end','end')}</div><label class="check-label"><input id="work-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="field"><label for="date-off" data-i18n="dates.off"></label><textarea id="date-off" dir="ltr" placeholder="2026-10-01, 2026-10-02"></textarea></div><div class="field"><label for="date-work" data-i18n="dates.work"></label><textarea id="date-work" dir="ltr" placeholder="2026-10-10"></textarea></div><p class="tool-note" data-i18n="dates.listHint"></p><p class="tool-note" data-i18n="dates.intervalHint"></p>${actions('workdays')}</section></div>`);
const today=Temporal.Now.plainDateISO().toString();for(const id of ['date-start','date-end','date-base','date-reference','work-start','work-end'])$(id).value=today;$('date-origin').value='2000-01-01';$('date-amount').value='7';
const results={};
const renderers={difference:value=>[t('dates.days',{value:value.days}),t('dates.weeks',{weeks:value.weeks,days:value.remainingDays}),t('dates.calendar',{years:value.years,months:value.months,days:value.calendarDays})].join('\n'),shift:value=>t('dates.shifted',{value}),milestone:value=>[t('dates.age',{value:value.years}),t('dates.next',{value:value.next}),t('dates.countdown',{value:value.days})].join('\n'),workdays:value=>t('dates.businessResult',{value})};
const computations={difference:()=>difference($('date-start').value,$('date-end').value,$('date-inclusive').checked),shift:()=>shiftDate($('date-base').value,$('date-amount').value,$('date-unit').value),milestone:()=>dateMilestone($('date-origin').value,$('date-reference').value),workdays:()=>businessDays($('work-start').value,$('work-end').value,{inclusive:$('work-inclusive').checked,off:parseDateList($('date-off').value),work:parseDateList($('date-work').value)})};
function render(id){$(id+'-output').textContent=results[id]===undefined?'':renderers[id](results[id]);$(id+'-copy').disabled=results[id]===undefined;}
for(const id of Object.keys(computations)){
  $(id+'-run').addEventListener('click',()=>{clearStatus();try{results[id]=computations[id]();render(id);}catch(error){results[id]=undefined;render(id);showError(error);}});
  $(id+'-copy').addEventListener('click',()=>copyText($(id+'-output').textContent));
  const card=$(id+'-run').closest('section');card.addEventListener('input',()=>{results[id]=undefined;render(id);clearStatus();});
}
for(const edge of ['start','end'])$(`date-today-${edge}`).addEventListener('click',()=>{$(`date-${edge}`).value=Temporal.Now.plainDateISO().toString();results.difference=undefined;render('difference');clearStatus();});
onLanguageChange(()=>Object.keys(renderers).forEach(render));
