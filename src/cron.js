import { mountTool, tr, localize, copyText, downloadText, notify } from './tools/shared/page.js';
import { language, onLanguageChange } from './i18n.js';
import { getDeviceTimeZone, timestampToTime } from './tools/timestamp/core.js';
import { createConversionController } from './tools/convert/controller.js';
import { parseCron, buildCronField } from './tools/cron/core.js';
import { exportCron } from './tools/cron/export.js';
import './tools/cron/style.css';

const $=id=>document.getElementById(id);
const label=(zh,en)=>`data-zh="${zh}" data-en="${en}"`;
$('tool-root').innerHTML=`
  <div class="page-heading"><div><h1 ${label('Cron 表达式','Cron expression')}></h1><p ${label('检查表达式、生成规则，并查看指定时区的未来执行时间。','Validate expressions, build rules and preview future dates in your timezone.')}></p></div></div>
  <section class="tool-card" aria-labelledby="cron-input-title">
    <h2 id="cron-input-title" ${label('表达式与计算范围','Expression and calculation context')}></h2>
    <div class="tool-fields cron-context">
      <div class="field"><label for="cron-dialect" ${label('方言','Syntax')}></label><select id="cron-dialect"><option value="linux" ${label('Linux（5 字段）','Linux (5 fields)')}></option><option value="seconds" ${label('含秒（6 字段）','With seconds (6 fields)')}></option><option value="quartz" ${label('Quartz（6 / 7 字段）','Quartz (6 / 7 fields)')}></option></select></div>
      <div class="field cron-expression-field"><label for="cron-expression" ${label('Cron 表达式','Cron expression')}></label><input id="cron-expression" value="*/5 * * * *" spellcheck="false" autocapitalize="off" autocomplete="off" dir="ltr" aria-describedby="cron-syntax-note cron-error"></div>
      <div class="field"><label for="cron-zone" ${label('IANA 时区（可搜索）','IANA timezone (searchable)')}></label><input id="cron-zone" list="cron-zones" autocomplete="off" spellcheck="false" dir="ltr"><datalist id="cron-zones"></datalist></div>
      <div class="field"><label for="cron-reference" ${label('参考时间（留空使用现在）','Reference time (blank means now)')}></label><input id="cron-reference" data-placeholder-zh="例如 2026-01-01 09:00:00 或 ISO 时间" data-placeholder-en="2026-01-01 09:00:00 or ISO datetime" autocomplete="off" spellcheck="false" dir="ltr"></div>
      <div class="field"><label for="cron-count" ${label('未来执行次数','Future dates')}></label><select id="cron-count"><option>10</option><option>20</option><option>50</option><option>100</option></select></div>
    </div>
    <p id="cron-syntax-note" class="tool-note"></p>
    <div class="tool-actions"><button id="cron-run" class="primary" ${label('计算执行时间','Calculate dates')}></button><button id="cron-cancel" disabled ${label('取消','Cancel')}></button><button id="cron-now" ${label('填入当前时间','Use current time')}></button><button id="cron-device-zone" ${label('使用设备时区','Use device timezone')}></button><button id="cron-copy-expression" ${label('复制表达式','Copy expression')}></button><label class="check-label"><input id="cron-auto" type="checkbox" checked><span ${label('自动计算','Auto calculate')}></span></label></div>
    <p id="cron-error" class="tool-error" role="alert" hidden></p>
    <div class="cron-presets"><span class="tool-note" ${label('常用规则：','Presets:')}></span><button data-preset="minute" ${label('每分钟','Every minute')}></button><button data-preset="five" ${label('每 5 分钟','Every 5 minutes')}></button><button data-preset="daily" ${label('每天 09:00','Daily at 09:00')}></button><button data-preset="weekdays" ${label('工作日 09:00','Weekdays at 09:00')}></button><button data-preset="monthly" ${label('每月 1 日','First day of month')}></button></div>
  </section>
  <details class="tool-card cron-builder"><summary ${label('可视化生成器','Visual builder')}></summary>
    <p class="tool-note" ${label('选择每个字段的规则后点击应用。高级表达式保留原值，不会被自动覆盖。','Choose rules and click Apply. Advanced fields keep their original values until you explicitly apply changes.')}></p>
    <div class="tool-actions"><button id="cron-builder-load" ${label('载入当前表达式','Load current expression')}></button><label id="cron-year-control" class="check-label" hidden><input id="cron-year" type="checkbox"><span ${label('包含年份字段','Include year field')}></span></label></div>
    <div id="cron-builder-fields"></div><p id="cron-builder-error" class="tool-error" role="alert" hidden></p>
    <div class="tool-actions"><button id="cron-builder-apply" ${label('应用到表达式','Apply to expression')}></button></div>
  </details>
  <section class="tool-card" aria-labelledby="cron-result-title"><div class="cron-result-heading"><h2 id="cron-result-title" ${label('解析与执行时间','Description and future dates')}></h2><span id="cron-status" class="tool-status" role="status" aria-live="polite"></span></div>
    <p id="cron-description" class="cron-description"></p><p id="cron-result-context" class="tool-note"></p>
    <div class="cron-table-scroll"><table class="tool-table" id="cron-fields"><thead><tr><th ${label('字段','Field')}></th><th ${label('当前值','Value')}></th><th ${label('范围','Range')}></th><th ${label('含义','Meaning')}></th></tr></thead><tbody></tbody></table></div>
    <div class="tool-actions"><button id="cron-copy-dates" disabled ${label('复制时间列表','Copy dates')}></button><button id="cron-download-csv" disabled ${label('下载 CSV','Download CSV')}></button><button id="cron-download-json" disabled ${label('下载 JSON','Download JSON')}></button></div>
    <div class="cron-table-scroll"><table class="tool-table" id="cron-dates"><thead><tr><th>#</th><th ${label('当地时间','Local time')}></th><th ${label('UTC 偏移','UTC offset')}></th><th ${label('UTC 时间','UTC time')}></th><th ${label('复制','Copy')}></th></tr></thead><tbody></tbody></table></div>
    <p class="tool-note" ${label('结果严格晚于参考时间。夏令时跳过不存在的当地时间；重复时刻采用第一次。Quartz 年份支持 1970–2099。本工具只预览，不创建定时任务。','Dates are strictly after the reference. DST gaps are skipped; overlaps use the first occurrence. Quartz years: 1970–2099. This tool previews dates only and does not schedule jobs.')}></p>
  </section>`;
mountTool('cron');
const device=getDeviceTimeZone();
$('cron-zone').value=device.timeZone;
let zones=[];
try { zones=Intl.supportedValuesOf('timeZone'); } catch { /* Manual IANA entry remains available. */ }
$('cron-zones').replaceChildren(...[...new Set(['UTC',device.timeZone,...zones])].sort().map(zone=>{const option=document.createElement('option');option.value=zone;return option;}));
let result, state={status:'idle'};
const controller=createConversionController({
  timeoutMs:2000, createWorker:()=>new Worker(new URL('./tools/cron/worker.js',import.meta.url),{type:'module'}),
  onState(next) {state=next;result=next.status==='ready' ? next : undefined;renderState();}
});
function syntaxNote() {
  const quartz=$('cron-dialect').value==='quartz';
  $('cron-syntax-note').textContent=quartz
    ? tr('秒 分 时 日期 月 星期 [年]；星期 1=周日、7=周六。日期与星期必须恰好有一个为 ?。支持 L、L-n、nW、LW、nL、n#1–5。','Second minute hour day month weekday [year]; 1=Sunday, 7=Saturday. Exactly one day field must be ?. Supports L, L-n, nW, LW, nL and n#1–5.')
    : tr(`${$('cron-dialect').value==='linux' ? '分 时 日期 月 星期' : '秒 分 时 日期 月 星期'}；星期 0/7=周日、1=周一。日期与星期均受限时使用 OR；不支持 ?、L、W、#。`,`${$('cron-dialect').value==='linux' ? 'Minute hour day month weekday' : 'Second minute hour day month weekday'}; 0/7=Sunday, 1=Monday. Restricted day fields use OR. ?, L, W and # are not supported.`);
  $('cron-year-control').hidden=!quartz;
}
function calculate(auto=false) {
  controller.process({input:$('cron-expression').value,options:{dialect:$('cron-dialect').value,timeZone:$('cron-zone').value,reference:$('cron-reference').value,count:Number($('cron-count').value),language:language()}},{auto});
}
function inputChanged() { if($('cron-auto').checked) calculate(true); else controller.invalidate(); }
function cell(row,value,mono=false) {const td=document.createElement('td');td.textContent=value;if(mono)td.className='cron-mono';row.append(td);return td;}
function meaning(field) {
  const value=field.value;
  if(value==='?') return tr('不指定，由另一个日期字段决定','Unspecified; use the other day field');
  if(value==='*') return tr('每个允许值','Every allowed value');
  if(value==='LW') return tr('每月最后一个工作日','Last weekday of the month');
  if(value==='L') return field.id==='weekday' ? tr('周六（7）','Saturday (7)') : tr('每月最后一天','Last day of the month');
  if(/^L-/.test(value)) return tr('距月末指定天数','Specified days before the last day');
  if(value.endsWith('W')) return tr('离指定日期最近的工作日，不跨月','Nearest weekday to the date, within the same month');
  if(value.endsWith('L')) return tr('每月最后一个指定星期','Last specified weekday of the month');
  if(value.includes('#')) return tr('每月第 n 个指定星期','Nth specified weekday of the month');
  if(value.includes('/')) return tr('按步长重复','Repeat at the specified step');
  if(value.includes(',') || value.includes('-')) return tr('指定列表或闭区间','Specified list or inclusive range');
  return tr('指定值','Specified value');
}
function renderState() {
  const ready=state.status==='ready';
  $('cron-status').textContent=({idle:tr('待计算','Ready to calculate'),pending:tr('计算中…','Calculating…'),ready:tr(`找到 ${state.dates?.length || 0} 次执行时间`,`${state.dates?.length || 0} dates found`),error:tr('校验失败','Validation failed'),cancelled:tr('已取消','Cancelled')})[state.status] || '';
  $('cron-cancel').disabled=state.status!=='pending';
  for(const id of ['cron-copy-dates','cron-download-csv','cron-download-json']) $(id).disabled=!ready || !state.dates.length;
  $('cron-error').hidden=state.status!=='error';
  $('cron-error').textContent=state.status==='error' ? tr(state.message,state.messageEn || state.message) : '';
  for(const [id,field] of [['cron-expression','expression'],['cron-zone','timeZone'],['cron-reference','reference']]) $(id).setAttribute('aria-invalid',String(state.status==='error' && (state.field===field || (field==='expression' && !['timeZone','reference','count'].includes(state.field)))));
  $('cron-description').textContent=ready ? state.description : '';
  $('cron-result-context').textContent=ready ? `${state.timeZone} · ${tr('参考时间','Reference')}: ${state.reference}${state.exhausted ? ' · '+tr('支持范围内没有更多匹配时间','No more matching dates in the supported range') : ''}` : '';
  const fields=$('cron-fields').tBodies[0], dates=$('cron-dates').tBodies[0];fields.replaceChildren();dates.replaceChildren();
  if(!ready) return;
  for(const field of state.parsed.fields) {const row=document.createElement('tr');cell(row,tr(field.zh,field.en));cell(row,field.value,true);cell(row,`${field.min}–${field.max}`);cell(row,meaning(field));fields.append(row);}
  state.dates.forEach((date,index)=>{
    const row=document.createElement('tr');cell(row,index+1);cell(row,date.localTime,true);cell(row,date.offset,true);cell(row,date.utcTime,true);
    const button=document.createElement('button');button.textContent=tr('复制','Copy');button.setAttribute('aria-label',tr(`复制第 ${index+1} 次执行时间`,`Copy date ${index+1}`));button.addEventListener('click',()=>copyText(date.isoTime));cell(row,'').append(button);dates.append(row);
  });
}
const modeLabels={keep:['保留原值','Keep original'],every:['每个值','Every value'],list:['指定列表','List'],range:['范围','Range'],step:['步长','Step'],unspecified:['不指定 (?)','Unspecified (?)']};
function builderParameters(row) {
  const mode=row.querySelector('select').value, [first,second]=row.querySelectorAll('input');
  row.dataset.name=tr(row.fieldDefinition.zh,row.fieldDefinition.en);
  row.querySelector('select').setAttribute('aria-label',tr(`${row.fieldDefinition.zh}规则`,`${row.fieldDefinition.en} rule`));
  first.hidden=['every','unspecified'].includes(mode);second.hidden=!['range','step'].includes(mode);first.readOnly=mode==='keep';
  const firstLabels=mode==='list' ? ['值（如 0,15,30）','Values (e.g. 0,15,30)'] : mode==='range' ? ['起始值','Start'] : mode==='step' ? ['起始值或 *','Start value or *'] : ['原始值','Original value'];
  first.placeholder=tr(...firstLabels);first.setAttribute('aria-label',`${row.dataset.name} · ${first.placeholder}`);
  second.placeholder=mode==='range' ? tr('结束值','End') : tr('步长','Step');second.setAttribute('aria-label',`${row.dataset.name} · ${second.placeholder}`);
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
    const row=document.createElement('div');row.className='cron-builder-row';row.dataset.field=field.id;row.dataset.name=tr(field.zh,field.en);row.fieldDefinition=field;
    const name=document.createElement('span');name.dataset.zh=field.zh;name.dataset.en=field.en;name.textContent=row.dataset.name;row.append(name);
    const mode=document.createElement('select');mode.setAttribute('aria-label',tr(`${field.zh}规则`,`${field.en} rule`));
    for(const value of ['keep','every','list','range','step',...($('cron-dialect').value==='quartz' && ['day','weekday'].includes(field.id) ? ['unspecified'] : [])]) {
      const option=document.createElement('option');option.value=value;[option.dataset.zh,option.dataset.en]=modeLabels[value];option.textContent=tr(...modeLabels[value]);mode.append(option);
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
  $('cron-builder-error').hidden=true;
}
$('cron-builder-apply').addEventListener('click',()=>{
  try {
    const expression=[...$('cron-builder-fields').children].map(row=>{
      const mode=row.querySelector('select').value,[first,second]=row.querySelectorAll('input');
      if(mode==='keep') return first.value;if(mode==='unspecified')return '?';
      return buildCronField(mode,{values:first.value,start:first.value,end:second.value,step:second.value},row.fieldDefinition);
    }).join(' ');
    parseCron(expression,$('cron-dialect').value);$('cron-expression').value=expression;$('cron-builder-error').hidden=true;calculate();
  } catch(error) {$('cron-builder-error').textContent=tr(error.message,error.messageEn || error.message);$('cron-builder-error').hidden=false;}
});
$('cron-builder-load').addEventListener('click',()=>{try {$('cron-year').checked=parseCron($('cron-expression').value,$('cron-dialect').value).fields.length===7;} catch {} loadBuilder();});
$('cron-year').addEventListener('change',loadBuilder);
for(const id of ['cron-expression','cron-zone','cron-reference']) $(id).addEventListener('input',inputChanged);
$('cron-count').addEventListener('change',inputChanged);
$('cron-dialect').addEventListener('change',()=>{syntaxNote();$('cron-year').checked=false;loadBuilder();inputChanged();});
$('cron-auto').addEventListener('change',()=>{$('cron-auto').checked ? calculate(true) : controller.invalidate();});
$('cron-run').addEventListener('click',()=>calculate());$('cron-cancel').addEventListener('click',()=>controller.cancel());
$('cron-now').addEventListener('click',()=>{const now=timestampToTime(String(Date.now()),'milliseconds',$('cron-zone').value);if(now.status!=='ready')return notify(tr(now.message,'Choose a valid IANA timezone.'));$('cron-reference').value=now.isoTime;inputChanged();});
$('cron-device-zone').addEventListener('click',()=>{$('cron-zone').value=getDeviceTimeZone().timeZone;inputChanged();});
$('cron-copy-expression').addEventListener('click',()=>copyText($('cron-expression').value));
$('cron-copy-dates').addEventListener('click',()=>{if(result)copyText(result.dates.map(date=>`${date.isoTime}\t${date.utcTime}`).join('\n'));});
for(const format of ['csv','json']) $(`cron-download-${format}`).addEventListener('click',()=>{if(result)downloadText(exportCron(result,format),`cron-dates.${format}`,format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8');});
for(const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click',()=>{
  const presets={linux:{minute:'* * * * *',five:'*/5 * * * *',daily:'0 9 * * *',weekdays:'0 9 * * MON-FRI',monthly:'0 0 1 * *'},seconds:{minute:'0 * * * * *',five:'0 */5 * * * *',daily:'0 0 9 * * *',weekdays:'0 0 9 * * MON-FRI',monthly:'0 0 0 1 * *'},quartz:{minute:'0 * * ? * *',five:'0 */5 * ? * *',daily:'0 0 9 * * ?',weekdays:'0 0 9 ? * MON-FRI',monthly:'0 0 0 1 * ?'}};
  $('cron-expression').value=presets[$('cron-dialect').value][button.dataset.preset];$('cron-year').checked=false;loadBuilder();calculate();
});
onLanguageChange(()=>{syntaxNote();localize();for(const row of $('cron-builder-fields').children)builderParameters(row);calculate(true);});
window.addEventListener('pagehide',()=>controller.cancel());
syntaxNote();loadBuilder();renderState();calculate();
