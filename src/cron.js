import {mountResultShortcut} from './tools/shared/workspace.js';
import {readPreferences,savePreferences} from './tools/shared/preferences.js';
import {addTaskGuide} from './tools/shared/task-guide.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import { mountTool, copyText, downloadText, notify } from './tools/shared/page.js';
import { t, language, onLanguageChange, translateDOM } from './i18n.js';
import {mountTimeZoneSelector} from './timezone-selector.js';
import './timestamp-style.css';
import { getDeviceTimeZone, timestampToTime } from './tools/timestamp/core.js';
import { createConversionController } from './tools/convert/controller.js';
import { parseCron, buildCronField } from './tools/cron/core.js';
import { exportCron } from './tools/cron/export.js';
import { describeCron } from './tools/cron/description.js';
import './tools/cron/style.css';

const $=id=>document.getElementById(id);
const label=key=>`data-i18n="${key}"`;
$('tool-root').innerHTML=`
  <div class="page-heading"><div><h1 ${label('cron.title')}></h1><p ${label('cron.description')}></p></div></div>
  <div class="cron-workspace">
  <section class="tool-card" aria-labelledby="cron-input-title">
    <h2 id="cron-input-title" ${label('cron.context')}></h2>
    <div class="tool-fields cron-context">
      <div class="field cron-expression-field"><label for="cron-expression" ${label('cron.title')}></label><input id="cron-expression" value="*/5 * * * *" spellcheck="false" autocapitalize="off" autocomplete="off" dir="ltr" aria-describedby="cron-syntax-note cron-error"></div>
      <div class="field"><label for="cron-dialect" ${label('cron.syntax')}></label><select id="cron-dialect"><option value="linux">Linux (5)</option><option value="seconds" ${label('cron.withSeconds')}></option><option value="quartz">Quartz (6 / 7)</option></select></div>
      <div class="field cron-timezone-field"><label id="cron-zone-caption" for="cron-zone-picker" ${label('timestamp.zone')}></label><div class="timezone-controls cron-timezone-controls"><select id="cron-zone-picker" aria-describedby="cron-error"></select><button id="cron-device-zone" ${label('timestamp.restore')}></button></div><details id="cron-custom-timezone"><summary ${label('direct.developer.customZone')}></summary><label for="cron-zone" class="sr-only" ${label('direct.developer.customZone')}></label><input id="cron-zone" list="cron-zones" autocomplete="off" spellcheck="false" dir="ltr"><datalist id="cron-zones"></datalist></details></div>
    </div>
    <div class="tool-actions"><button id="cron-run" class="primary" ${label('cron.run')}></button><button id="cron-cancel" disabled ${label('common.cancel')}></button><button id="cron-copy-expression" ${label('cron.copyExpression')}></button><label class="check-label"><input id="cron-auto" type="checkbox" checked><span ${label('cron.auto')}></span></label></div>
    <div id="cron-error" class="tool-error" role="alert" hidden><span id="cron-error-message"></span><details><summary data-i18n="cron.technicalDetails"></summary><pre id="cron-error-details" dir="ltr"></pre></details></div>
    <div class="cron-presets"><label for="cron-presets" class="sr-only" data-i18n="ux.templates"></label><select id="cron-presets"></select><button hidden data-preset="minute" ${label('cron.everyMinute')}></button><button hidden data-preset="five" ${label('cron.fiveMinutes')}></button><button hidden data-preset="daily" ${label('cron.daily')}></button><button hidden data-preset="weekdays"></button><button hidden data-preset="monthly" ${label('cron.monthly')}></button></div>
  <details class="cron-builder" hidden><summary ${label('cron.builder')}></summary>
    <p class="tool-note" ${label('cron.builderHint')}></p>
    <div class="tool-actions"><button id="cron-builder-load" ${label('cron.load')}></button><label id="cron-year-control" class="check-label" hidden><input id="cron-year" type="checkbox"><span ${label('cron.includeYear')}></span></label></div>
    <div id="cron-builder-fields"></div><p id="cron-builder-error" class="tool-error" role="alert" hidden></p>
    <div class="tool-actions"><button id="cron-builder-apply" ${label('cron.apply')}></button></div>
  </details>
    <details id="cron-preview-settings"><summary data-i18n="ux.previewSettings"></summary><div class="tool-fields">
      <div class="field"><label for="cron-count" ${label('cron.count')}></label><select id="cron-count"><option>10</option><option>20</option><option>50</option><option>100</option></select></div><div class="field"><label for="cron-reference" ${label('cron.reference')}></label><input id="cron-reference" placeholder="2026-01-01 09:00:00 / 2026-01-01T09:00:00Z" autocomplete="off" spellcheck="false" dir="ltr"></div><button id="cron-now" ${label('timestamp.fillNow')}></button>
    </div></details>
  </section>
  <section class="tool-card" aria-labelledby="cron-result-title"><div class="cron-result-heading"><h2 id="cron-result-title" ${label('cron.results')}></h2><span id="cron-status" class="tool-status" role="status" aria-live="polite"></span></div>
    <p id="cron-effective-context" class="tool-note"></p><p id="cron-description" class="cron-description"></p><p id="cron-next" class="result-conclusion"></p><p id="cron-result-context" class="tool-note"></p>

    <div class="tool-actions"><button id="cron-copy-dates" disabled ${label('cron.copyDates')}></button><button id="cron-download-csv" disabled ${label('common.download')}></button><button id="cron-download-json" disabled ${label('common.download')}></button></div>
    <div class="cron-table-scroll cron-dates-scroll"><table class="tool-table" id="cron-dates"><thead><tr><th>#</th><th ${label('timestamp.local')}></th><th ${label('direct.developer.copyIso')}></th></tr></thead><tbody></tbody></table></div>
    <p class="tool-note" ${label('cron.notes')}></p>
    <details class="cron-field-details"><summary data-i18n="cron.field"></summary><p id="cron-syntax-note" class="tool-note"></p>
    <div class="cron-table-scroll"><table class="tool-table" id="cron-fields"><thead><tr><th ${label('cron.field')}></th><th ${label('common.value')}></th><th ${label('cron.range')}></th><th ${label('cron.meaning')}></th></tr></thead><tbody></tbody></table></div>
    </details>
  </section>
  </div>`;
mountTool('cron');
translateDOM($('tool-root'));
const device=getDeviceTimeZone();
$('cron-zone').value=readPreferences().options.timeZone||device.timeZone;
let zones=[];
try { zones=Intl.supportedValuesOf('timeZone'); } catch { /* Manual IANA entry remains available. */ }
const zoneValues=new Set(['UTC',device.timeZone,...zones]);
const zonePicker=mountTimeZoneSelector($('cron-zone-picker'),{t,language,labelId:'cron-zone-caption'});zoneValues.add($('cron-zone').value);zonePicker.setZones(zoneValues,$('cron-zone').value);
$('cron-zones').replaceChildren(...[...zoneValues].sort().map(zone=>{const option=document.createElement('option');option.value=zone;return option;}));
function saveCronZone(){const prefs=readPreferences();savePreferences({...prefs,options:{...prefs.options,timeZone:$('cron-zone').value}});}
$('cron-zone-picker').addEventListener('change',()=>{$('cron-zone').value=$('cron-zone-picker').value;saveCronZone();inputChanged();});
$('cron-zone').addEventListener('change',()=>{try{new Intl.DateTimeFormat('en',{timeZone:$('cron-zone').value});saveCronZone();zoneValues.add($('cron-zone').value);zonePicker.setZones(zoneValues,$('cron-zone').value);}catch{/* Core validation reports an invalid custom zone. */}});
let result, presentation, presentationRequest, requestKey, renderedPresentation, renderedLanguage, builderError, descriptionRequest=0, state={status:'idle'};
const controller=createConversionController({
  timeoutMs:2000, createWorker:()=>new Worker(new URL('./tools/cron/worker.js',import.meta.url),{type:'module'}),
  onState(next) {
    state=next;result=next.status==='ready' ? next : undefined;
    if(result){presentation=result;presentationRequest=requestKey;}else if(next.status!=='pending')presentation=undefined;
    renderState();
  }
});
function workingDays() {
  const format=new Intl.DateTimeFormat(language(),{weekday:'long',timeZone:'UTC'});
  return [1,5].map(day=>format.format(Date.UTC(2024,0,day))).join('–');
}
function syntaxNote() {
  const dialect=$('cron-dialect').value,quartz=dialect==='quartz';
  const fields=[...(dialect==='linux'?[]:['second']),'minute','hour','day','month','weekday'];
  $('cron-syntax-note').textContent=fields.map(id=>t(`cron.fields.${id}`)).join(' · ')+(quartz?' ['+t('cron.fields.year')+']':'')+' — '+t(quartz?'cron.syntaxQuartz':'cron.syntaxLinux');
  $('cron-year-control').hidden=!quartz;
  document.querySelector('[data-preset="weekdays"]').textContent=`${workingDays()} 09:00`;
}
function calculate(auto=false) {
  const request={input:$('cron-expression').value,options:{dialect:$('cron-dialect').value,timeZone:$('cron-zone').value,reference:$('cron-reference').value,count:Number($('cron-count').value)}};
  requestKey=JSON.stringify(request);if(requestKey!==presentationRequest)presentation=undefined;
  controller.process(request,{auto});
}
function inputChanged() { if($('cron-auto').checked) calculate(true); else controller.invalidate(); }
function cell(row,value,mono=false) {const td=document.createElement('td');td.textContent=value;if(mono)td.className='cron-mono';row.append(td);return td;}
function meaning(field) {
  const value=field.value;
  const key=value==='?'?'unspecified':value==='*'?'every':value==='LW'?'lastWeekday':value==='L'?(field.id==='weekday'?'saturday':'lastDay'):/^L-/.test(value)?'offset':value.endsWith('W')?'nearest':value.endsWith('L')?'lastNamedWeekday':value.includes('#')?'nth':value.includes('/')?'step':/[,-]/.test(value)?'list':'value';
  return t(`cron.meanings.${key}`,{days:value.slice(2),n:value.split('#')[1],...(['lastWeekday','nearest'].includes(key)?{weekdays:workingDays()}:{})});
}
function errorMessage(error) {
  if(error.code?.startsWith('timestamp.'))return t(error.code,error.params);
  if(error.code==='TaskTimeout')return t('office.timeout');
  const code=['dialect','empty','inputLimit','reboot','alias','fieldCount','field','questionMark','count'].includes(error.code)?error.code:'invalid';
  return t(`cron.errors.${code}`,{...error.params,field:t(`cron.fields.${error.field || 'minute'}`)});
}
function renderBuilderError() {
  $('cron-builder-error').hidden=!builderError;
  $('cron-builder-error').textContent=builderError?errorMessage(builderError):'';
}
async function renderDescription() {
  const revision=++descriptionRequest,source=presentation,locale=language();
  $('cron-description').textContent=source?t('cron.descriptionFallback'):'';
  if(!source)return;
  const description=await describeCron(source.parsed,locale);
  if(revision===descriptionRequest && presentation===source && language()===locale && description)$('cron-description').textContent=description;
}
function renderState() {
  const ready=state.status==='ready',shown=presentation;
  $('cron-result-title').closest('section').setAttribute('aria-busy',String(state.status==='pending'));
  for(const button of $('cron-dates').querySelectorAll('tbody button'))button.disabled=!ready;
  $('cron-status').textContent=({idle:t('cron.idle'),pending:t('common.processing'),ready:t('cron.found',{count:state.dates?.length || 0}),error:t('common.error'),cancelled:t('office.cancelled')})[state.status] || '';
  $('cron-cancel').disabled=state.status!=='pending';
  for(const id of ['cron-copy-dates','cron-download-csv','cron-download-json']) $(id).disabled=!ready || !state.dates.length;
  $('cron-error').hidden=state.status!=='error';
  $('cron-error-message').textContent=state.status==='error'?errorMessage(state):'';
  $('cron-zone-picker').setAttribute('aria-invalid',String(state.status==='error'&&state.field==='timeZone'));if(state.status==='error'&&state.field==='timeZone')$('cron-custom-timezone').open=true;
  $('cron-error-details').textContent=state.status==='error'?`${state.code || state.errorCode || 'invalid'}: ${state.messageEn || state.message || ''}`:'';
  for(const [id,field] of [['cron-expression','expression'],['cron-zone','timeZone'],['cron-reference','reference']]) $(id).setAttribute('aria-invalid',String(state.status==='error' && (state.field===field || (field==='expression' && !['timeZone','reference','count'].includes(state.field)))));
  for(const format of ['csv','json'])$(`cron-download-${format}`).textContent=`${t('common.download')} ${format.toUpperCase()}`;
  if(renderedPresentation===shown && renderedLanguage===language())return;
  renderedPresentation=shown;renderedLanguage=language();
  const effective=$('cron-effective-context');effective.hidden=!shown;effective.textContent=shown?t('refinement.cronContext',{dialect:$('cron-dialect').selectedOptions[0].textContent,count:shown.parsed.fields.length,zone:shown.timeZone}):'';
  $('cron-next').textContent=shown?.dates.length?t('ux.nextExecution')+' · '+shown.dates[0].localTime:'';
  void renderDescription();
  const context=$('cron-result-context');context.replaceChildren();
  if(shown) {
    const zone=document.createElement('bdi'),reference=document.createElement('bdi');zone.dir=reference.dir='ltr';zone.textContent=shown.timeZone;reference.textContent=shown.reference;
    context.append(zone,` · ${t('cron.referenceLabel')}: `,reference,shown.exhausted?' · '+t('cron.exhausted'):'');
  }
  const fields=$('cron-fields').tBodies[0], dates=$('cron-dates').tBodies[0];fields.replaceChildren();dates.replaceChildren();
  if(!shown) return;
  for(const field of shown.parsed.fields) {const row=document.createElement('tr');cell(row,t(`cron.fields.${field.id}`));cell(row,field.value,true);cell(row,`${field.min}–${field.max}`,true);cell(row,meaning(field));fields.append(row);}
  shown.dates.forEach((date,index)=>{
    const row=document.createElement('tr');cell(row,index+1);const dateCell=cell(row,'');const local=document.createElement('span');local.className='cron-local-time';local.textContent=date.localTime;const secondary=document.createElement('small');secondary.className='cron-time-context';secondary.textContent=`${date.utcTime} · UTC${date.offset}`;const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='UTC';summary.setAttribute('aria-label',t('ux.otherFormats')+' · UTC');detail.append(summary,secondary);dateCell.append(local,detail);
    const button=document.createElement('button');button.disabled=!ready;button.textContent=t('direct.developer.copyIso');button.setAttribute('aria-label',`${button.textContent} · ${t('direct.developer.copyIsoDate',{index:index+1})}`);button.addEventListener('click',()=>copyText(date.isoTime));cell(row,'').append(button);dates.append(row);
  });
}

function builderParameters(row) {
  const mode=row.querySelector('select').value, [first,second]=row.querySelectorAll('input');
  row.dataset.name=t(`cron.fields.${row.fieldDefinition.id}`);
  row.querySelector('select').setAttribute('aria-label',t('cron.rule',{field:row.dataset.name}));
  first.hidden=['every','unspecified'].includes(mode);second.hidden=!['range','step'].includes(mode);first.readOnly=mode==='keep';
  first.placeholder=t(mode==='list'?'cron.values':mode==='range'?'cron.start':mode==='step'?'cron.stepStart':'common.value');first.setAttribute('aria-label',`${row.dataset.name} · ${first.placeholder}`);
  second.placeholder=t(mode==='range'?'cron.end':'cron.modes.step');second.setAttribute('aria-label',`${row.dataset.name} · ${second.placeholder}`);
}
function loadBuilder() {
  let parsed;
  try {parsed=parseCron($('cron-expression').value,$('cron-dialect').value);}
  catch {parsed=parseCron($('cron-dialect').value==='linux' ? '* * * * *' : $('cron-dialect').value==='seconds' ? '* * * * * *' : '0 * * ? * *',''+$('cron-dialect').value);}
  if($('cron-dialect').value==='quartz') {
    if($('cron-year').checked && parsed.fields.length===6) parsed.fields.push(parseCron('0 0 0 ? * * *','quartz').fields.at(-1));
    if(!$('cron-year').checked) parsed.fields=parsed.fields.filter(field=>field.id!=='year');
  }
  const container=$('cron-builder-fields');container.replaceChildren();
  for(const field of parsed.fields) {
    const row=document.createElement('div');row.className='cron-builder-row';row.dataset.field=field.id;row.dataset.name=t(`cron.fields.${field.id}`);row.fieldDefinition=field;
    const name=document.createElement('span');name.dataset.i18n=`cron.fields.${field.id}`;name.textContent=row.dataset.name;row.append(name);
    const mode=document.createElement('select');mode.setAttribute('aria-label',t('cron.rule',{field:row.dataset.name}));
    for(const value of ['keep','every','list','range','step',...($('cron-dialect').value==='quartz' && ['day','weekday'].includes(field.id) ? ['unspecified'] : [])]) {
      const option=document.createElement('option');option.value=value;option.dataset.i18n=value==='range'?'cron.range':value==='every'?'cron.meanings.every':`cron.modes.${value}`;option.textContent=t(option.dataset.i18n);mode.append(option);
    }
    const first=document.createElement('input'),second=document.createElement('input');first.dir=second.dir='ltr';first.spellcheck=second.spellcheck=false;
    const token=field.value;first.value=token;
    if(token==='*') mode.value='every';else if(token==='?') mode.value='unspecified';
    else if(/^(\d+|\*)\/\d+$/.test(token)) {mode.value='step';[first.value,second.value]=token.split('/');}
    else if(/^\d+-\d+$/.test(token)) {mode.value='range';[first.value,second.value]=token.split('-');}
    else if(/^\d+(,\d+)*$/.test(token)) {mode.value='list';first.value=token;}
    else {mode.value='keep';first.value=token;}
    row.append(mode,first,second);container.append(row);builderParameters(row);mode.addEventListener('change',()=>{if(mode.value==='step' && !first.value)first.value='*';builderParameters(row);});
  }
  builderError=undefined;renderBuilderError();
}
$('cron-builder-apply').addEventListener('click',()=>{
  try {
    const expression=[...$('cron-builder-fields').children].map(row=>{
      const mode=row.querySelector('select').value,[first,second]=row.querySelectorAll('input');
      if(mode==='keep') return first.value;if(mode==='unspecified')return '?';
      return buildCronField(mode,{values:first.value,start:first.value,end:second.value,step:second.value},row.fieldDefinition);
    }).join(' ');
    parseCron(expression,$('cron-dialect').value);$('cron-expression').value=expression;builderError=undefined;renderBuilderError();calculate();
  } catch(error) {builderError=error;renderBuilderError();}
});
$('cron-builder-load').addEventListener('click',()=>{try {$('cron-year').checked=parseCron($('cron-expression').value,$('cron-dialect').value).fields.length===7;} catch {} loadBuilder();});
$('cron-year').addEventListener('change',loadBuilder);
for(const id of ['cron-expression','cron-zone','cron-reference']) $(id).addEventListener('input',inputChanged);
$('cron-count').addEventListener('change',inputChanged);
$('cron-dialect').addEventListener('change',()=>{syntaxNote();$('cron-year').checked=false;loadBuilder();inputChanged();});
$('cron-auto').addEventListener('change',()=>{$('cron-auto').checked ? calculate(true) : controller.invalidate();});
document.querySelector('.cron-workspace').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&event.target.matches('#cron-expression,#cron-zone,#cron-reference')&&!$('cron-auto').checked){event.preventDefault();calculate();}});
$('cron-run').addEventListener('click',()=>calculate());$('cron-cancel').addEventListener('click',()=>controller.cancel());
$('cron-now').addEventListener('click',()=>{const now=timestampToTime(String(Date.now()),'milliseconds',$('cron-zone').value);if(now.status!=='ready')return notify(t('timestamp.invalidZone'));$('cron-reference').value=now.isoTime;inputChanged();});
$('cron-device-zone').addEventListener('click',()=>{const zone=getDeviceTimeZone().timeZone;zoneValues.add(zone);$('cron-zone').value=zone;zonePicker.setZones(zoneValues,zone);saveCronZone();inputChanged();});
$('cron-copy-expression').addEventListener('click',()=>copyText($('cron-expression').value));
$('cron-copy-dates').addEventListener('click',()=>{if(result)copyText(result.dates.map(date=>`${date.isoTime}\t${date.utcTime}`).join('\n'));});
for(const format of ['csv','json']) $(`cron-download-${format}`).addEventListener('click',()=>{if(result)downloadText(exportCron(result,format),`cron-dates.${format}`,format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8');});
for(const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click',()=>{
  const presets={linux:{minute:'* * * * *',five:'*/5 * * * *',daily:'0 9 * * *',weekdays:'0 9 * * MON-FRI',monthly:'0 0 1 * *'},seconds:{minute:'0 * * * * *',five:'0 */5 * * * *',daily:'0 0 9 * * *',weekdays:'0 0 9 * * MON-FRI',monthly:'0 0 0 1 * *'},quartz:{minute:'0 * * ? * *',five:'0 */5 * ? * *',daily:'0 0 9 * * ?',weekdays:'0 0 9 ? * MON-FRI',monthly:'0 0 0 1 * ?'}};
  $('cron-expression').value=presets[$('cron-dialect').value][button.dataset.preset];$('cron-year').checked=false;loadBuilder();calculate();
});
onLanguageChange(()=>{
  const scroll=[...document.querySelectorAll('main,.cron-table-scroll')].map(element=>[element,element.scrollTop,element.scrollLeft]);
  zonePicker.refresh();syntaxNote();translateDOM($('tool-root'));for(const row of $('cron-builder-fields').children)builderParameters(row);renderBuilderError();renderState();
  for(const [element,top,left] of scroll){element.scrollTop=top;element.scrollLeft=left;}
});
window.addEventListener('pagehide',()=>controller.cancel());
syntaxNote();loadBuilder();renderState();calculate();

$('cron-custom-timezone').append($('cron-device-zone'));
let cronEngaged=false;document.querySelector('#tool-root').addEventListener('input',()=>{cronEngaged=true;});document.querySelector('#cron-run').addEventListener('click',()=>{cronEngaged=true;});

registerContentCheck(()=>Boolean($('cron-expression').value&&($('cron-expression').value!=='*/5 * * * *'||cronEngaged)));

const cronBuilder=document.querySelector('.cron-builder');
addTaskGuide('cron',[{id:'parse',key:'ux.parseCron'},{id:'build',key:'ux.buildCron'}],{choose(task){cronBuilder.hidden=task!=='build';cronBuilder.open=task==='build';$('cron-run').hidden=task==='build';$('cron-builder-apply').classList.toggle('primary',task==='build');}});
const presetButtons=[...document.querySelectorAll('[data-preset]')],presetSelect=$('cron-presets');
function refreshCronPresets(){presetSelect.replaceChildren(...[['',t('ux.templates')],...presetButtons.map(button=>[button.dataset.preset,button.textContent])].map(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;return option;}));presetSelect.setAttribute('aria-label',t('ux.templates'));}
presetSelect.onchange=()=>{presetButtons.find(button=>button.dataset.preset===presetSelect.value)?.click();presetSelect.value='';};
onLanguageChange(refreshCronPresets);refreshCronPresets();renderState();

const cronResultSection=$('cron-result-title').closest('section');cronResultSection.id='cron-results';mountResultShortcut($('cron-run').parentElement,cronResultSection,()=>Boolean(presentation),'usabilityShared.viewTimes');
