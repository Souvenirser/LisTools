import {mountResultShortcut} from './tools/shared/workspace.js';
import {bindAutoRun} from './tools/shared/auto-run.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import {Temporal} from 'temporal-polyfill/implementation';
import {initTool,$,showError,clearStatus,setStatus,submitForm} from './tools/shared/office.js';
import {copyText} from './tools/shared/page.js';
import {t,language,translateDOM,onLanguageChange,errorText} from './i18n.js';
import {parseDateList} from './tools/dates/core.js';
import {calculateDateResult,dateTimestamp} from './tools/dates/results.js';
import {getDeviceTimeZone} from './tools/timestamp/core.js';
import {mountTimeZoneSelector} from './timezone-selector.js';
import './tools/calculator/style.css';
import './timestamp-style.css';
import {addTaskGuide} from './tools/shared/task-guide.js';

const field=(id,key,type='date')=>`<div class="field"><label for="${id}" data-i18n="dates.${key}"></label><input id="${id}" type="${type}" dir="ltr" ${type==='date'?'min="0001-01-01" max="9999-12-31"':''}></div>`;
const actions=id=>`<div class="tool-actions"><button id="${id}-run" class="primary" data-i18n="dates.calculate"></button><button id="${id}-copy" data-i18n="common.copyAll" hidden disabled></button></div><output id="${id}-output" class="tool-output" aria-live="polite"></output>`;
initTool('dates',`<div class="tool-grid">
<section class="tool-card"><h2 data-i18n="dates.difference"></h2><div class="tool-fields">${field('date-start','start')}${field('date-end','end')}</div><label class="check-label"><input id="date-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="tool-actions"><button id="date-today-start" data-i18n="dates.todayStart"></button><button id="date-today-end" data-i18n="dates.todayEnd"></button></div><p class="tool-note" data-i18n="direct.daily.countdownHelp"></p>${actions('difference')}</section>
<section class="tool-card"><h2 data-i18n="dates.shift"></h2><div class="tool-fields">${field('date-base','base')}${field('date-amount','amount','number')}<div class="field"><label for="date-unit" data-i18n="dates.unit"></label><select id="date-unit">${['day','week','month','year'].map(unit=>`<option value="${unit}s" data-i18n="dates.${unit}Unit"></option>`).join('')}</select></div></div><p class="tool-note" data-i18n="dates.constrain"></p>${actions('shift')}</section>
<section class="tool-card"><h2 data-i18n="dates.milestone"></h2><div class="tool-fields">${field('date-origin','origin')}${field('date-reference','reference')}</div><p class="tool-note" data-i18n="direct.daily.anniversaryHelp"></p>${actions('milestone')}</section>
<section class="tool-card"><h2 data-i18n="dates.workdays"></h2><div class="tool-fields">${field('work-start','start')}${field('work-end','end')}</div><label class="check-label"><input id="work-inclusive" type="checkbox"><span data-i18n="dates.inclusive"></span></label><div class="field"><label for="date-off" data-i18n="dates.off"></label><textarea id="date-off" dir="ltr" placeholder="2026-10-01, 2026-10-02"></textarea></div><div class="field"><label for="date-work" data-i18n="dates.work"></label><textarea id="date-work" dir="ltr" placeholder="2026-10-10"></textarea></div><p class="tool-note" data-i18n="dates.listHint"></p><p class="tool-note" data-i18n="dates.intervalHint"></p>${actions('workdays')}</section></div>`);
const today=Temporal.Now.plainDateISO().toString();
for(const id of ['date-start','date-end','date-base','date-reference','work-start','work-end'])$(id).value=today;
$('date-origin').value='';$('date-amount').value='7';
const results={},statuses={},dateAutos=new Map(),dateTasks=['difference','shift','milestone','workdays'];
let dateEngaged=false,dateTask='difference';
const device=getDeviceTimeZone(),settings=document.createElement('section');settings.className='date-time-settings';
settings.innerHTML='<div class="tool-fields"><div class="field"><label for="date-time" data-i18n="reading.timeForTimestamps"></label><input id="date-time" type="time" step="0.001" value="00:00:00" dir="ltr"></div><div class="field"><label id="date-zone-caption" for="date-zone" data-i18n="timestamp.zone"></label><div class="timezone-controls"><select id="date-zone"></select></div></div></div><p class="tool-note" data-i18n="reading.timeBasisHelp"></p><p id="date-zone-fallback" class="tool-note" data-i18n="timestamp.fallback" hidden></p>';
// Mounted once, moved beside the current result without recreating the picker.
const zoneValues=new Set(['UTC',device.timeZone]);try{for(const zone of Intl.supportedValuesOf('timeZone'))zoneValues.add(zone);}catch{/* UTC and the device zone remain selectable. */}
let zonePicker;
const readInput=id=>id==='shift'?{base:$('date-base').value,amount:$('date-amount').value,unit:$('date-unit').value}:id==='milestone'?{origin:$('date-origin').value,reference:$('date-reference').value}:id==='difference'?{start:$('date-start').value,end:$('date-end').value,inclusive:$('date-inclusive').checked}:{start:$('work-start').value,end:$('work-end').value,inclusive:$('work-inclusive').checked,off:$('date-off').value,work:$('date-work').value};
function renderStatus(focus=false){clearStatus();const status=statuses[dateTask];if(status?.error)showError(status.error,{field:status.field,focus});else if(status?.stale)setStatus('ux.stale');}
function errorField(id,error){
 if(error.code==='dates.invalidAmount')return 'date-amount';if(error.code==='dates.futureOrigin')return 'date-origin';if(error.code==='dates.outOfRange')return id==='shift'?'date-amount':'date-reference';if(error.code==='dates.rangeTooLarge')return 'work-end';
 const fields={difference:['date-start','date-end'],shift:['date-base'],milestone:['date-origin','date-reference'],workdays:['date-off','date-work','work-start','work-end']}[id];
 for(const name of fields){try{if(['date-off','date-work'].includes(name))parseDateList($(name).value);else parseDateList($(name).value||'invalid');}catch{return name;}}return fields[0];
}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function conditions(result){
 const {task,input}=result;
 if(task==='shift')return `${input.base} ${Number(input.amount)<0?'−':'+'} ${Math.abs(Number(input.amount))} ${t('dates.'+input.unit.slice(0,-1)+'Unit')}`;
 if(task==='milestone')return `${input.origin} → ${input.reference}`;
 const lines=[`${input.start} → ${input.end}`,t(input.inclusive?'dates.inclusive':'ux.excludeEnd')];
 if(task==='workdays')lines.push(t('redesign.workdayExceptions',{off:new Set(parseDateList(input.off)).size,work:new Set(parseDateList(input.work)).size}));return lines.join('\n');
}
function weekday(date){return new Intl.DateTimeFormat(language(),{weekday:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
function copyButton(label,value){const button=node('button','',t('common.copy'));button.type='button';button.setAttribute('aria-label',`${t('common.copy')} · ${label}`);button.onclick=()=>copyText(value);return button;}
function dateLine(date,label){const block=node('div','date-conclusion');block.append(node('span','date-primary-label',label));const value=node('bdi','date-primary-value',date);value.dir='ltr';block.append(value,node('span','date-weekday',weekday(date)),copyButton(label,date));return block;}
function timeRows(date,label){
 const block=node('div','date-time-values'),result=dateTimestamp(date,$('date-time').value,$('date-zone').value);
 if(label)block.append(node('h3','date-time-heading',label));
 if(result.status!=='ready'){const message=node('p','date-time-error',result.code==='timestamp.ambiguous'?t('reading.transitionError'):errorText(result));message.dataset.timeError='';block.append(message);return block;}
 const list=node('dl');
 function row(field,key){const label=t(key),value=result[field],element=node('div','date-value-row'),output=node('dd','',value);output.dir='ltr';output.dataset.timeField=field;element.append(node('dt','',label),output,copyButton(label,value));list.append(element);}
 row('localTime','timestamp.date');const context=node('p','date-detail',`${result.timeZone} · UTC${result.offset}`);context.dir='ltr';block.append(context,list);
 row('seconds','timestamp.seconds');row('milliseconds','timestamp.milliseconds');
 const details=node('details'),summary=node('summary','',t('reading.otherFormats')),extra=node('dl');details.append(summary,extra);block.append(details);
 for(const [field,key]of [['utcTime','timestamp.utc'],['isoTime','timestamp.iso']]){row(field,key);extra.append(list.lastElementChild);}return block;
}
function renderTimes(id){
 const host=$(id+'-times');if(!host)return;const open=[...host.querySelectorAll('details')].map(element=>element.open);host.replaceChildren();const result=results[id];if(!result)return;
 if(['difference','workdays'].includes(id))host.append(node('p','tool-note',t('reading.intervalTimeHelp')));
 for(const item of result.dates)host.append(timeRows(item.date,['result','next'].includes(item.key)?'':t('dates.'+item.key)));
 [...host.querySelectorAll('details')].forEach((element,index)=>{element.open=Boolean(open[index]);});
}
function render(id){
 const output=$(id+'-output'),result=results[id],open=[...output.querySelectorAll('details')].map(element=>element.open);output.replaceChildren();
 if(result){
  const {value}=result;
  if(id==='shift')output.append(dateLine(value,t('reading.calculatedDate')));
  else if(id==='milestone')output.append(node('div','date-conclusion',t('dates.age',{value:value.years})),dateLine(value.next,t('reading.nextDate')),node('p','date-detail',t('dates.countdown',{value:value.days})));
  else output.append(node('div','date-conclusion',t(id==='difference'?'dates.days':'dates.businessResult',{value:id==='difference'?value.days:value})));
  if(id==='difference')output.append(node('p','date-detail',t('dates.weeks',{weeks:value.weeks,days:value.remainingDays})),node('p','date-detail',t('dates.calendar',{years:value.years,months:value.months,days:value.calendarDays})));
  output.append(node('p','date-condition',conditions(result)));
  const host=node('div');host.id=id+'-times';
  if(['difference','workdays'].includes(id)){const details=node('details','date-interval-times');details.append(node('summary','',t('reading.rangeTimes')),host);output.append(details);}else output.append(host);
  renderTimes(id);
  [...output.querySelectorAll('details')].forEach((element,index)=>{element.open=Boolean(open[index]);});
 }
 $(id+'-copy').disabled=!result;$(id+'-copy').hidden=!result;
}
function summary(id){
 const result=results[id];if(!result)return '';const {value}=result,main=id==='shift'?t('dates.shifted',{value}):id==='milestone'?[t('dates.age',{value:value.years}),t('dates.next',{value:value.next}),t('dates.countdown',{value:value.days})].join('\n'):id==='difference'?[t('dates.days',{value:value.days}),t('dates.weeks',{weeks:value.weeks,days:value.remainingDays}),t('dates.calendar',{years:value.years,months:value.months,days:value.calendarDays})].join('\n'):t('dates.businessResult',{value});
 const lines=[conditions(result),main,`${t('reading.timeForTimestamps')}: ${$('date-time').value}`,`${t('timestamp.zone')}: ${$('date-zone').value}`];
 if(id==='workdays')lines.push(`${t('dates.off')}: ${result.input.off||'—'}`,`${t('dates.work')}: ${result.input.work||'—'}`);
 for(const item of result.dates){const time=dateTimestamp(item.date,$('date-time').value,$('date-zone').value);lines.push(item.date);if(time.status==='ready')for(const [field,key]of [['localTime','timestamp.date'],['seconds','timestamp.seconds'],['milliseconds','timestamp.milliseconds'],['utcTime','timestamp.utc'],['isoTime','timestamp.iso']])lines.push(`${t(key)}: ${time[field]}`);else lines.push(t('reading.unavailable')+': '+(time.code==='timestamp.ambiguous'?t('reading.transitionError'):errorText(time)));}return lines.join('\n');
}
const dateCards=dateTasks.map(id=>$(id+'-run').closest('section'));
for(const [index,card]of dateCards.entries()){
 const id=dateTasks[index],input=node('div'),output=node('div','date-result'),actions=$(id+'-run').parentElement;
 card.classList.add('date-task');output.id=id+'-result';input.append(...card.childNodes);input.querySelector('h2').remove();card.append(input,output);
 output.append(node('h2','',t('common.result')),$(id+'-output'),$(id+'-copy'));mountResultShortcut(actions,output,()=>Boolean(results[id]));
 if(id==='workdays'){const details=node('details');details.append(node('summary','',`${t('dates.off')} / ${t('dates.work')}`),$('date-off').closest('.field'),$('date-work').closest('.field'));actions.before(details);}
 const form=submitForm(input,$(id+'-run'));
 const calculate=(focus=false)=>{statuses[id]=undefined;try{results[id]=calculateDateResult(id,readInput(id));}catch(error){results[id]=undefined;statuses[id]={error,field:errorField(id,error)};}render(id);renderStatus(focus);};
 $(id+'-run').addEventListener('click',()=>{dateEngaged=true;calculate(true);});$(id+'-copy').onclick=()=>copyText(summary(id));
 form.addEventListener('input',()=>{dateEngaged=true;const stale=Boolean(results[id]||statuses[id]?.stale);results[id]=undefined;statuses[id]=stale?{stale:true}:undefined;render(id);renderStatus();});
 const required={difference:['date-start','date-end'],shift:['date-base','date-amount'],milestone:['date-origin','date-reference'],workdays:['work-start','work-end']}[id];
 dateAutos.set(id,bindAutoRun(form,()=>calculate(false),{button:$(id+'-run'),canRun:()=>dateTask===id&&required.every(name=>$(name).value&&$(name).validity.valid)&&(id!=='workdays'||new TextEncoder().encode($('date-off').value+$('date-work').value).length<=256*1024)}));
}

dateCards[0].parentElement.classList.add('date-workspace');dateCards[0].firstElementChild.append(settings);
zonePicker=mountTimeZoneSelector($('date-zone'),{t,language,labelId:'date-zone-caption'});zonePicker.setZones(zoneValues,device.timeZone);$('date-zone-fallback').hidden=!device.fallback;
const refreshTimes=()=>{dateEngaged=true;for(const id of dateTasks)renderTimes(id);};$('date-time').addEventListener('input',refreshTimes);$('date-zone').addEventListener('change',refreshTimes);
for(const edge of ['start','end']){const button=$('date-today-'+edge);button.classList.add('quiet');$('date-'+edge).closest('.field').append(button);button.onclick=()=>{const input=$('date-'+edge),value=Temporal.Now.plainDateISO().toString();if(input.value===value)return;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};}
addTaskGuide('dates',dateTasks.map(id=>({id,key:`dates.${id}`})),{choose:id=>{for(const auto of dateAutos.values())auto.cancel();dateTask=id;dateCards.forEach((card,index)=>{card.hidden=dateTasks[index]!==id;});dateCards[dateTasks.indexOf(id)].firstElementChild.append(settings);dateAutos.get(id)?.schedule();renderStatus();}});
function localize(){zonePicker.refresh();translateDOM(settings);for(const [index,card]of dateCards.entries()){card.querySelector('.date-result>h2').textContent=t('common.result');const details=card.querySelector('details:has(#date-off)>summary');if(details)details.textContent=`${t('dates.off')} / ${t('dates.work')}`;render(dateTasks[index]);}}
onLanguageChange(localize);dateCards.forEach((card,index)=>{card.hidden=dateTasks[index]!==dateTask;translateDOM(card);render(dateTasks[index]);});translateDOM(settings);
registerContentCheck(()=>dateEngaged||['date-start','date-end','date-base','date-reference','work-start','work-end'].some(id=>$(id).value!==today)||$('date-origin').value!==''||$('date-amount').value!=='7'||Boolean($('date-off').value||$('date-work').value));
