import {initTool,$,showError,setStatus} from './tools/shared/office.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import {t,language,onLanguageChange} from './i18n-runtime.js';
import {defaultConfig,normalizeConfig,calendarDays,shiftTimes,monthAt} from './tools/salary/core.js';
import {salaryStore,scheduleKey} from './tools/salary/store.js';
import {money,readSalarySnapshot,toggleMask} from './tools/salary/view.js';
import {toggleSalaryWindow,isSalaryWindowOpen} from './tools/salary/floating.js';
import {mountTimeZoneSelector} from './timezone-selector.js';
import {getDeviceTimeZone} from './tools/timestamp/core.js';
import {monthHolidays,applyHolidaySchedule} from './tools/salary/holidays.js';
import './timestamp-style.css';
import './tools/salary/style.css';
const label=(key,input)=>`<label class="field" for="salary-${key}"><span data-i18n="salary.${key}"></span>${input}</label>`;
const number=(id,value,extra='')=>`<input id="salary-${id}" type="number" value="${value}" ${extra}>`;
initTool('salary',`<div class="salary-dashboard"><section class="tool-card salary-overview" tabindex="-1" hidden><h2><span data-i18n="salary.monthEarned"></span> <time id="salary-active-month" dir="ltr"></time></h2><output id="salary-earned" class="salary-main-value" dir="ltr" aria-live="off">—</output><p id="salary-state" class="salary-state" role="status"></p><p id="salary-encouragement" class="salary-encouragement"></p><progress id="salary-progress" max="100" value="0" data-i18n-aria-label="salary.progress"></progress><dl class="salary-summary">${['today','hourly','perMinute','perSecond'].map(id=>`<div><dt data-i18n="salary.${id}"></dt><dd id="salary-${id}" dir="ltr">—</dd></div>`).join('')}</dl><p id="salary-plan-stats" class="tool-note"></p><div class="tool-actions"><button id="salary-pip" type="button" data-i18n="salary.pip"></button><button id="salary-bar-toggle" type="button" data-i18n="salary.showBar"></button><button id="salary-mask" type="button" data-i18n="salary.mask"></button></div><p class="tool-note" data-i18n="salary.pipHelp"></p></section><section class="tool-card salary-settings"><h2 data-i18n="salary.settings"></h2><form id="salary-form" novalidate><div class="salary-form-fields">${label('amount','<input id="salary-amount" type="text" inputmode="decimal" maxlength="64" autocomplete="off" spellcheck="false" dir="ltr">')}${label('hours',number('hours','8','min="0" max="24" step="any"'))}${label('start','<input id="salary-start" type="time" value="09:00">')}${label('end','<output id="salary-end" dir="ltr"></output>')}
${label('mode','<select id="salary-mode"><option value="cycle" data-i18n="salary.cycle"></option><option value="monthly" data-i18n="salary.monthly"></option></select>')}<div class="salary-review-action"><button id="salary-review" type="button" class="primary" data-i18n="salary.reviewCalendar"></button></div>
<div id="salary-cycle-fields" class="salary-form-fields salary-full">${label('work-days',number('work-days','5','min="1" step="1"'))}${label('rest-days',number('rest-days','2','min="0" step="1"'))}${label('anchor','<input id="salary-anchor" type="date">')}</div><div id="salary-monthly-fields" class="salary-full" hidden>${label('monthly-rest',number('monthly-rest','0','min="0" step="1"'))}</div>
${label('lunch-start','<input id="salary-lunch-start" type="time" value="12:00">')}${label('lunch-minutes',number('lunch-minutes','60','min="0" step="1"'))}
<div class="field salary-full salary-timezone timezone-controls"><label id="salary-zone-caption" for="salary-zone" data-i18n="salary.zone"></label><select id="salary-zone"></select><button id="salary-zone-device" type="button" data-i18n="timestamp.restore"></button><p class="tool-note" data-i18n="salary.zoneHelp"></p></div></div><p id="salary-draft-notice" class="tool-note" hidden></p><p class="tool-note" data-i18n="salary.storageNote"></p></form></section><section class="tool-card"><h2 id="salary-calendar-title" tabindex="-1"></h2><p class="tool-note" data-i18n="salary.calendarHint"></p><p id="salary-calendar-notice" class="tool-note" role="status" hidden></p><div class="tool-actions"><button id="salary-apply-holidays" type="button" data-i18n="salary.applyHolidays"></button><button id="salary-weekends" type="button" data-i18n="salary.weekends"></button><button id="salary-reset-days" type="button" data-i18n="salary.resetDays"></button></div><p id="salary-holiday-info" class="tool-note"></p><a id="salary-holiday-source" href="https://github.com/NateScarlet/holiday-cn/releases" class="tool-note" target="_blank" rel="noopener" data-i18n="salary.holidaySourceLink"></a><p id="salary-calendar-summary" class="tool-note"></p><div id="salary-calendar" class="salary-calendar" tabindex="-1"></div><p class="tool-note" data-i18n="salary.scopeNote"></p><div class="tool-actions"><button id="salary-save" form="salary-form" type="submit" class="primary" data-i18n="salary.save"></button><button id="salary-clear" type="button" data-i18n="salary.clear" hidden></button></div></section></div><dialog id="salary-confirm" class="salary-confirm" aria-labelledby="salary-confirm-title"><h2 id="salary-confirm-title"></h2><p id="salary-confirm-copy"></p><div class="tool-actions"><button id="salary-confirm-apply" type="button" class="primary" data-i18n="salary.confirm"></button><button id="salary-confirm-cancel" type="button" data-i18n="salary.cancel"></button></div></dialog>`);
let draft,dirty=false,external=false,pendingAction,previousState='',clearPending=false,pipPending=false,writePending=false,draftMasked=false,calendarNotice,activeConfig;
registerContentCheck(()=>dirty||writePending||pipPending||isSalaryWindowOpen()||Boolean(draft&&(
 inputs().mode==='cycle'?draft.offDays.length:Object.keys(draft.overrides).length)));
let supportedZones=[];try{supportedZones=Intl.supportedValuesOf('timeZone');}catch{/* Keep device and saved IANA zones available. */}
const zoneValues=new Set(['UTC',getDeviceTimeZone().timeZone,...supportedZones]);
const zonePicker=mountTimeZoneSelector($('salary-zone'),{t,language,labelId:'salary-zone-caption'});
const festivalKeys={'元旦':'newYear','春节':'spring','清明节':'qingming','劳动节':'labour','端午节':'dragonBoat','国庆节':'national','中秋节':'midAutumn','国庆节、中秋节':'nationalMidAutumn'};
const minuteText=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const asNumber=id=>$(id).value===''?NaN:Number($(id).value);
function fill(config,preserveInactive=false){
 const current=monthAt(Date.now(),config.timeZone),keepInactive=preserveInactive&&draft?.month===current;
 draft={...config,month:current,
  offDays:keepInactive&&config.mode==='cycle'?draft.offDays:config.month===current?[...config.offDays]:[],
  overrides:keepInactive&&config.mode==='monthly'?draft.overrides:config.month===current?{...config.overrides}:{}};
 draftMasked=config.masked;calendarNotice=undefined;
 for(const [field,key]of [['amount','salary'],['hours','hours'],['start','start'],['lunch-start','lunchStart'],['lunch-minutes','lunchMinutes'],['mode','mode'],['work-days','workDays'],['rest-days','restDays'],['anchor','anchor'],['monthly-rest','monthlyRestDays']])$('salary-'+field).value=String(draft[key]);
 zoneValues.add(draft.timeZone);zonePicker.setZones(zoneValues,draft.timeZone);dirty=false;external=false;renderCalendar();
}
function inputs(){return {...draft,salary:$('salary-amount').value,hours:$('salary-hours').value,start:$('salary-start').value,lunchStart:$('salary-lunch-start').value,lunchMinutes:asNumber('salary-lunch-minutes'),mode:$('salary-mode').value,workDays:asNumber('salary-work-days'),restDays:asNumber('salary-rest-days'),anchor:$('salary-anchor').value,monthlyRestDays:asNumber('salary-monthly-rest'),timeZone:$('salary-zone').value||draft.timeZone};}
function syncMonth(notice='salary.monthReset'){
 const month=monthAt(Date.now(),inputs().timeZone);if(month===draft.month)return false;
 draft={...inputs(),month,offDays:[],overrides:{}};dirty=true;calendarNotice=notice;renderCalendar();return true;
}
function renderCalendar(){
 const raw=inputs(),active=document.activeElement?.dataset.salaryDate,container=$('salary-calendar');$('salary-cycle-fields').hidden=raw.mode!=='cycle';$('salary-monthly-fields').hidden=raw.mode!=='monthly';$('salary-lunch-start').disabled=!raw.lunchMinutes;$('salary-calendar-title').textContent=t('salary.calendar')+' · '+draft.month;
 try{$('salary-end').textContent=minuteText(shiftTimes(raw).endMinutes);}catch{$('salary-end').textContent='—';}
 const notice=$('salary-calendar-notice');notice.hidden=!calendarNotice;if(calendarNotice&&notice.textContent!==t(calendarNotice))notice.textContent=t(calendarNotice);
 const holidays=monthHolidays(draft.month),holidayDates=new Map(holidays.days.map(day=>[day.date,day]));
 $('salary-holiday-source').href='https://github.com/NateScarlet/holiday-cn/'+(holidays.version?'tree/'+holidays.version:'releases');
 $('salary-apply-holidays').disabled=!holidays.available||!holidays.days.length;$('salary-holiday-info').textContent=holidays.available?t('salary.holidaySource',{year:holidays.year,version:holidays.version})+(holidays.days.length?'':' '+t('salary.noMonthHolidays')):t('salary.holidaysUnavailable',{year:holidays.year});
 container.replaceChildren();let days;
 try{days=calendarDays(raw,draft.month);}catch{$('salary-calendar-summary').textContent=t('salary.completeSchedule');return;}
 for(let index=0;index<7;index++){const node=document.createElement('span');node.className='salary-weekday';node.textContent=new Intl.DateTimeFormat(language(),{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,10,2+index)));container.append(node);}
 for(let i=1;i<days[0].weekday;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');container.append(blank);}
 for(const day of days){
  const button=document.createElement('button');button.type='button';button.dataset.salaryDate=day.date;button.dataset.work=String(day.work);button.dataset.overridden=String(day.overridden);button.setAttribute('aria-pressed',String(!day.work));button.setAttribute('aria-label',`${day.day} ${t('salary.'+(day.work?'work':'rest'))} · ${day.date}`);
  const count=document.createElement('span'),state=document.createElement('small');count.textContent=String(day.day);state.textContent=t('salary.'+(day.work?'work':'rest'));button.append(count,document.createTextNode(' '),state);
  const holiday=holidayDates.get(day.date);if(holiday){const badge=document.createElement('small');badge.className='salary-holiday';badge.textContent=(festivalKeys[holiday.name]?t('salary.festival_'+festivalKeys[holiday.name]):holiday.name)+' · '+t(holiday.isOffDay?'salary.holidayOff':'salary.holidayWork');button.append(document.createTextNode(' '),badge);button.setAttribute('aria-label',`${day.day} ${state.textContent} ${badge.textContent} · ${day.date}`);}
  button.onclick=()=>{const raw=inputs();if(raw.mode==='monthly'){const dates=new Set(draft.offDays);if(dates.has(day.date))dates.delete(day.date);else dates.add(day.date);draft.offDays=[...dates];}else{const next=!day.work;if(next===day.baseWork)delete draft.overrides[day.date];else draft.overrides[day.date]=next?'work':'rest';}dirty=true;container.dispatchEvent(new Event('input',{bubbles:true}));};container.append(button);
 }
 const work=days.filter(day=>day.work).length;$('salary-calendar-summary').textContent=t('salary.calendarSummary',{work,rest:days.length-work,selected:days.length-work,expected:raw.monthlyRestDays});
 if(active)container.querySelector(`[data-salary-date="${active}"]`)?.focus({preventScroll:true});
}
function render(){
 syncMonth();const {config,result}=readSalarySnapshot();
 document.querySelector('.salary-overview').hidden=!config;
 $('salary-save').disabled=writePending;$('salary-form').inert=writePending;$('salary-calendar').parentElement.inert=writePending;
 $('salary-review').hidden=Boolean(config);$('salary-clear').hidden=!config&&!clearPending;
 const activeMonth=$('salary-active-month');if(config){const month=monthAt(Date.now(),config.timeZone);activeMonth.dateTime=month;activeMonth.textContent=month;}$('salary-earned').textContent=money(result.earned,config?.masked);for(const key of ['today','hourly','perMinute','perSecond'])$('salary-'+key).textContent=money(result[key],config?.masked);
 const state=$('salary-state');if(previousState!==result.state||state.textContent!==t('salary.state_'+result.state)){state.textContent=t('salary.state_'+result.state);state.dataset.state=result.state;previousState=result.state;}
 $('salary-encouragement').textContent=t('salary.encourage_'+result.state);$('salary-progress').value=result.progress||0;
 $('salary-plan-stats').textContent=result.error?t(result.error.code,result.error.params):result.plan?.totalMs?t('salary.planStats',{work:result.plan.workDays,rest:result.plan.restDays,hours:String(result.plan.totalMs/3600000)}):'';
 const pipOpen=isSalaryWindowOpen();$('salary-pip').disabled=pipPending||(!config&&!pipOpen);$('salary-pip').dataset.i18n=pipOpen?'salary.pipClose':'salary.pip';$('salary-pip').textContent=t($('salary-pip').dataset.i18n);$('salary-pip').setAttribute('aria-pressed',String(pipOpen));$('salary-mask').disabled=$('salary-bar-toggle').disabled=!config;$('salary-bar-toggle').textContent=t(config?.showBar?'salary.hideBar':'salary.showBar');$('salary-bar-toggle').setAttribute('aria-pressed',String(Boolean(config?.showBar)));$('salary-clear').disabled=!config&&!clearPending;$('salary-mask').textContent=t(config?.masked?'salary.showAmounts':'salary.mask');$('salary-mask').setAttribute('aria-pressed',String(Boolean(config?.masked)));if(config)draftMasked=config.masked;$('salary-amount').type=draftMasked?'password':'text';
 $('salary-draft-notice').hidden=!dirty;$('salary-draft-notice').textContent=t(external?'salary.externalNotice':'salary.draftNotice');
}
function ask(key,action){pendingAction=action;$('salary-confirm-title').textContent=t('salary.'+key);$('salary-confirm-copy').textContent=t('salary.'+(key==='clear'?'clearConfirm':'recalcConfirm'));$('salary-confirm').showModal();}
$('salary-confirm-cancel').onclick=()=>$('salary-confirm').close();$('salary-confirm-apply').onclick=()=>{const action=pendingAction;$('salary-confirm').close();action?.();};$('salary-confirm').addEventListener('close',()=>{pendingAction=undefined;});
async function saveDraft(confirmation){
 if(writePending)return;
 syncMonth();
 if(confirmation&&confirmation.month!==draft.month){render();$('salary-calendar-title').focus();return;}
 try{
  const raw=inputs();
  const config=normalizeConfig({...raw,masked:draftMasked,offDays:raw.mode==='monthly'?raw.offDays:[],overrides:raw.mode==='cycle'?raw.overrides:{}});
  const expected=confirmation?confirmation.expected:scheduleKey(salaryStore.read());
  if(!confirmation&&(expected!==null||external)){ask('recalculate',()=>saveDraft({month:config.month,expected}));return;}
  clearPending=false;
  writePending=true;render();
  const result=await salaryStore.saveSchedule(config,expected);
  writePending=false;
  if(result.conflict){dirty=true;external=true;setStatus('salary.saveConflict');render();return;}
  dirty=false;external=false;calendarNotice=undefined;renderCalendar();setStatus(result.saved?'salary.saved':'salary.notSaved');render();
  const overview=document.querySelector('.salary-overview');overview.scrollIntoView({block:'start'});overview.focus({preventScroll:true});
 }catch(error){writePending=false;render();showError(error,{field:error.field,focus:true});}
}
$('salary-review').onclick=()=>{$('salary-calendar-title').scrollIntoView({block:'start'});$('salary-calendar-title').focus({preventScroll:true});};
$('salary-form').addEventListener('submit',event=>{event.preventDefault();saveDraft();});
$('salary-form').addEventListener('input',event=>{if(event.target.closest('.choices')||event.target===$('salary-mode')||event.target===$('salary-zone'))return;dirty=true;renderCalendar();render();});
$('salary-calendar').addEventListener('input',()=>{dirty=true;renderCalendar();render();});
$('salary-mode').addEventListener('change',()=>{dirty=true;calendarNotice='salary.modeDrafts';renderCalendar();render();});
$('salary-weekends').onclick=()=>{try{const raw=inputs(),days=calendarDays(raw,draft.month);if(raw.mode==='monthly')draft.offDays=days.filter(day=>day.weekday>5).map(day=>day.date);else draft.overrides=Object.fromEntries(days.filter(day=>(day.weekday<=5)!==day.baseWork).map(day=>[day.date,day.weekday<=5?'work':'rest']));dirty=true;$('salary-calendar').dispatchEvent(new Event('input',{bubbles:true}));}catch(error){showError(error,{field:error.field,focus:true});}};
$('salary-reset-days').onclick=()=>{if(inputs().mode==='monthly')draft.offDays=[];else draft.overrides={};calendarNotice='salary.dateDraftReset';$('salary-calendar').dispatchEvent(new Event('input',{bubbles:true}));};
$('salary-clear').onclick=()=>{
 const expected=scheduleKey(salaryStore.read());
 ask('clear',async()=>{
  writePending=true;render();
  try{
   const cleared=await salaryStore.clear(expected);
   if(cleared===null){setStatus('salary.clearConflict');return;}
   clearPending=!cleared;fill(defaultConfig());setStatus(cleared?'salary.cleared':'salary.clearFailed');
  }finally{writePending=false;render();}
 });
};
$('salary-mask').onclick=async()=>{if((await toggleMask())?.saved===false)setStatus('salary.localDisplayOnly');};
$('salary-apply-holidays').onclick=()=>{try{draft=applyHolidaySchedule(inputs());dirty=true;renderCalendar();render();setStatus('salary.holidaysDraft');}catch(error){showError(error,{field:error.field,focus:true});}};
$('salary-zone').addEventListener('change',()=>{dirty=true;if(!syncMonth('salary.zoneMonthReset'))renderCalendar();render();});
$('salary-zone-device').onclick=()=>{const zone=getDeviceTimeZone().timeZone;zoneValues.add(zone);zonePicker.setZones(zoneValues,zone);$('salary-zone').dispatchEvent(new Event('change',{bubbles:true}));};
$('salary-bar-toggle').onclick=async()=>{try{const result=await salaryStore.updateDisplay(config=>({showBar:!config.showBar}));if(!result)return;if(result.config.showBar)(await import('./tools/salary/widget.js')).mountSalaryBar();if(!result.saved)setStatus('salary.notSaved');}catch(error){showError(error);}};
$('salary-pip').onclick=async()=>{if(pipPending)return;pipPending=true;render();try{await toggleSalaryWindow(render);}catch(error){showError(error);}finally{pipPending=false;render();}};
activeConfig=salaryStore.read();fill(activeConfig||defaultConfig());render();
salaryStore.subscribe((config,isExternal)=>{
 if(scheduleKey(config)!==scheduleKey(activeConfig)){
  if(isExternal&&dirty){external=true;if(!config)draftMasked=true;}
  else if(!dirty)fill(config||defaultConfig(),Boolean(config));
 }
 activeConfig=config;render();
});
onLanguageChange(()=>{zonePicker.refresh();renderCalendar();render();});const refresh=()=>{render();};addEventListener('focus',refresh);addEventListener('pageshow',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(()=>{if(!document.hidden)render();},1000);addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);});
