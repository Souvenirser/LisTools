import {registerContentCheck} from './tools/shared/content-state.js';
import { Temporal } from 'temporal-polyfill/implementation';
import { initTool, $, showError, clearStatus, setStatus, submitForm } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import { difference, shiftDate, businessDays, dateMilestone, parseDateList } from './tools/dates/core.js';
import './tools/calculator/style.css';
import { addTaskGuide } from './tools/shared/task-guide.js';
const field=(id,key,type='date')=>`<div class="field"><label for="${id}" data-i18n="dates.${key}"></label><input id="${id}" type="${type}" dir="ltr"></div>`;
const actions=id=>`<div class="tool-actions"><button id="${id}-run" class="primary" data-i18n="dates.calculate"></button><button id="${id}-copy" data-i18n="dates.copy" disabled></button></div><output id="${id}-output" class="tool-output" aria-live="polite"></output>`;
initTool('dates',`<div class="tool-grid">
<section class="tool-card"><h2 data-i18n="dates.difference"></h2><div class="tool-fields">${field('date-start','start')}${field('date-end','end')}</div><label class="check-label"><input id="date-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="tool-actions"><button id="date-today-start" data-i18n="dates.todayStart"></button><button id="date-today-end" data-i18n="dates.todayEnd"></button></div><p class="tool-note" data-i18n="direct.daily.countdownHelp"></p>${actions('difference')}</section>
<section class="tool-card"><h2 data-i18n="dates.shift"></h2><div class="tool-fields">${field('date-base','base')}${field('date-amount','amount','number')}<div class="field"><label for="date-unit" data-i18n="dates.unit"></label><select id="date-unit">${['day','week','month','year'].map(unit=>`<option value="${unit}s" data-i18n="dates.${unit}Unit"></option>`).join('')}</select></div></div><p class="tool-note" data-i18n="dates.constrain"></p>${actions('shift')}</section>
<section class="tool-card"><h2 data-i18n="dates.milestone"></h2><div class="tool-fields">${field('date-origin','origin')}${field('date-reference','reference')}</div><p class="tool-note" data-i18n="direct.daily.anniversaryHelp"></p>${actions('milestone')}</section>
<section class="tool-card"><h2 data-i18n="dates.workdays"></h2><div class="tool-fields">${field('work-start','start')}${field('work-end','end')}</div><label class="check-label"><input id="work-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="field"><label for="date-off" data-i18n="dates.off"></label><textarea id="date-off" dir="ltr" placeholder="2026-10-01, 2026-10-02"></textarea></div><div class="field"><label for="date-work" data-i18n="dates.work"></label><textarea id="date-work" dir="ltr" placeholder="2026-10-10"></textarea></div><p class="tool-note" data-i18n="dates.listHint"></p><p class="tool-note" data-i18n="dates.intervalHint"></p>${actions('workdays')}</section></div>`);
const today=Temporal.Now.plainDateISO().toString();for(const id of ['date-start','date-end','date-base','date-reference','work-start','work-end'])$(id).value=today;$('date-origin').value='';$('date-amount').value='7';
const results={},statuses={};
let dateTask='difference';
function renderStatus(focus=false){clearStatus();const status=statuses[dateTask];if(status?.error)showError(status.error,{field:status.field,focus});else if(status?.stale)setStatus('ux.stale');}
function errorField(id,error){
  const fields={difference:['date-start','date-end'],shift:['date-base'],milestone:['date-origin','date-reference'],workdays:['date-off','date-work','work-start','work-end']}[id];
  if(error.code==='dates.invalidAmount')return 'date-amount';
  if(error.code==='dates.futureOrigin')return 'date-origin';
  if(error.code==='dates.outOfRange')return 'date-amount';
  if(error.code==='dates.rangeTooLarge')return 'work-end';
  for(const field of fields){try{if(field==='date-off'||field==='date-work')parseDateList($(field).value);else Temporal.PlainDate.from($(field).value,{overflow:'reject'});}catch{return field;}}
  return fields[0];
}
const renderers={difference:value=>[t('dates.days',{value:value.days}),t('dates.weeks',{weeks:value.weeks,days:value.remainingDays}),t('dates.calendar',{years:value.years,months:value.months,days:value.calendarDays})].join('\n'),shift:value=>t('dates.shifted',{value}),milestone:value=>[t('dates.age',{value:value.years}),t('dates.next',{value:value.next}),t('dates.countdown',{value:value.days})].join('\n'),workdays:value=>[t('dates.businessResult',{value}),`${$('work-start').value} → ${$('work-end').value}`,t($('work-inclusive').checked?'dates.inclusive':'ux.excludeEnd'),t('redesign.workdayExceptions',{off:new Set(parseDateList($('date-off').value)).size,work:new Set(parseDateList($('date-work').value)).size})].join('\n')};
const computations={difference:()=>difference($('date-start').value,$('date-end').value,$('date-inclusive').checked),shift:()=>shiftDate($('date-base').value,$('date-amount').value,$('date-unit').value),milestone:()=>dateMilestone($('date-origin').value,$('date-reference').value),workdays:()=>businessDays($('work-start').value,$('work-end').value,{inclusive:$('work-inclusive').checked,off:parseDateList($('date-off').value),work:parseDateList($('date-work').value)})};
function render(id){const output=$(id+'-output');output.replaceChildren();if(results[id]!==undefined){const [first,...rest]=renderers[id](results[id]).split('\n'),main=document.createElement('strong');main.className='date-conclusion';main.textContent=first;output.append(main,document.createTextNode(rest.length?'\n'+rest.join('\n'):''));}$(id+'-copy').disabled=results[id]===undefined;}
for(const id of Object.keys(computations)){
  $(id+'-run').addEventListener('click',()=>{statuses[id]=undefined;try{results[id]=computations[id]();}catch(error){results[id]=undefined;statuses[id]={error,field:errorField(id,error)};}render(id);renderStatus(true);});
  $(id+'-copy').addEventListener('click',()=>{const values={difference:[$('date-start').value,$('date-end').value],shift:[$('date-base').value,$('date-amount').value+' '+$('date-unit').selectedOptions[0].textContent],milestone:[$('date-origin').value,$('date-reference').value],workdays:[$('work-start').value,$('work-end').value]}[id];const rule=id==='difference'||id==='workdays'?t($(id==='difference'?'date-inclusive':'work-inclusive').checked?'dates.inclusive':'ux.excludeEnd'):'';const exceptions=id==='workdays'?[t('dates.off')+': '+($('date-off').value||'—'),t('dates.work')+': '+($('date-work').value||'—')]:[];copyText([...values,rule,...exceptions,$(id+'-output').textContent].filter(Boolean).join('\n'));});
  const card=$(id+'-run').closest('section');card.addEventListener('input',()=>{const stale=results[id]!==undefined||statuses[id]?.stale;results[id]=undefined;statuses[id]=stale?{stale:true}:undefined;render(id);renderStatus();});
}
for(const edge of ['start','end'])$(`date-today-${edge}`).addEventListener('click',()=>{const input=$(`date-${edge}`),value=Temporal.Now.plainDateISO().toString();if(input.value===value)return;input.value=value;results.difference=undefined;statuses.difference=undefined;render('difference');renderStatus();});
onLanguageChange(()=>Object.keys(renderers).forEach(render));

const dateTasks=Object.keys(computations);
const dateCards=dateTasks.map(id=>$(id+'-run').closest('section'));
for(const [index,card] of dateCards.entries()){
  card.classList.add('date-task');
  const input=document.createElement('div'),output=document.createElement('div');output.className='date-result';
  const id=dateTasks[index],actions=$(id+'-run').parentElement;
  input.append(...card.childNodes);card.append(input,output);input.querySelector('h2').dataset.i18n='refinement.dateInput';
  const heading=document.createElement('h2');heading.dataset.i18n='common.result';output.append(heading,$(id+'-output'),$(id+'-copy'));
  if(id==='workdays'){
    const details=document.createElement('details');details.innerHTML='<summary><span data-i18n="dates.off"></span> / <span data-i18n="dates.work"></span></summary>';
    actions.before(details);details.append($('date-off').closest('.field'),$('date-work').closest('.field'));
  }
}
dateCards[0].parentElement.classList.add('date-workspace');
addTaskGuide('dates',dateTasks.map(id=>({id,key:`dates.${id}`})),{choose:id=>{dateTask=id;dateCards.forEach((card,index)=>{card.hidden=dateTasks[index]!==id;});renderStatus();}});
dateCards.forEach((card,index)=>{card.hidden=index!==0;translateDOM(card);});

registerContentCheck(()=>Object.values(results).some(value=>value!==undefined)||['date-start','date-end','date-base','date-reference','work-start','work-end'].some(id=>$(id).value!==today)||$('date-origin').value!==''||$('date-amount').value!=='7'||Boolean($('date-off').value||$('date-work').value));

for(const edge of ['start','end']){const button=$('date-today-'+edge);button.classList.add('quiet');$('date-'+edge).closest('.field').append(button);}for(const card of dateCards){submitForm(card.firstElementChild,card.querySelector('button.primary'));}
