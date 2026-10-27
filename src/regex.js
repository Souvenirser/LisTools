import {actionArea} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import { textLabel as tr } from './tools/shared/labels.js';
import { t, translateDOM } from './i18n.js';
import {EditorState,StateEffect,StateField} from '@codemirror/state';
import {Decoration,EditorView,WidgetType} from '@codemirror/view';
import {createConversionController} from './tools/convert/controller.js';
import {limits} from './tools/regex/core.js';
import {findRules} from './tools/regex/rules.js';
import {copyText,downloadText,notify,mountTool,localize,createEditor} from './tools/shared/page.js';
import {onLanguageChange} from './i18n.js';
import './tools/regex/style.css';

const $=id=>document.getElementById(id);
$('tool-root').innerHTML=`
  <div class="page-heading"><h1 data-i18n="uiText.sa7af6118"></h1><p data-i18n="uiText.s7ce236cc"></p></div>
  <section class="tool-card">
    <div class="tool-fields">
      <div class="field regex-pattern-field"><label for="regex-pattern" data-i18n="uiText.sa8b63863"></label><textarea id="regex-pattern" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off">(?&lt;word&gt;\\w+)</textarea></div>
      <div class="field regex-flags-field"><label for="regex-flags" data-i18n="uiText.s4222ebcc"></label><input id="regex-flags" value="g" spellcheck="false" autocapitalize="off" autocomplete="off"><div id="regex-flag-options" class="regex-flags"></div></div>
    </div>
    <div class="tool-fields">
      <div class="field"><label for="regex-operation" data-i18n="uiText.s218e02a6"></label><select id="regex-operation"><option value="match" data-i18n="uiText.s52951b36"></option><option value="extract" data-i18n="uiText.s30518e1e"></option><option value="replace" data-i18n="uiText.se4d54f63"></option></select></div>
      <div class="field" id="regex-group-field" hidden><label for="regex-group" data-i18n="uiText.sead5fd8d"></label><select id="regex-group"><option value="0" data-i18n="uiText.sfc8e66e5"></option></select></div>
    </div>
    <div id="regex-replacement-panel" hidden><label class="regex-editor-label" for="regex-replacement" data-i18n="uiText.s3e13a26c"></label><div id="regex-replacement" class="regex-small-editor"></div><p class="tool-note" data-i18n="uiText.s48b64467"></p></div>
    <div class="tool-actions"><button id="regex-run" type="button" class="primary" data-i18n="uiText.s8d57e66a"></button><button id="regex-cancel" type="button" class="btn" disabled data-i18n="uiText.s35afca3b"></button><label class="check-label"><input id="regex-auto" type="checkbox" checked><span data-i18n="uiText.sb3a5078c"></span></label><button id="regex-locate" type="button" class="btn" hidden data-i18n="uiText.sfebb6a08"></button></div>
    <p class="tool-note" data-i18n="uiText.s2c32a032"></p>
    <div id="regex-status" class="tool-status" role="status" aria-live="polite"></div>
  </section>
  <div class="tool-grid">
    <section class="tool-card"><h2 data-i18n="uiText.sb2ece352"></h2><div id="regex-source"></div><div class="tool-actions"><button id="regex-clear" class="btn" type="button" data-i18n="uiText.sf384ddba"></button><span id="regex-input-info" class="tool-note"></span></div><p class="tool-note" data-i18n="uiText.se75dfc0b"></p></section>
    <section class="tool-card"><h2 id="regex-output-title" data-i18n="uiText.s504af044"></h2><div id="regex-output"></div><p id="regex-preview-info" class="tool-note"></p><div class="tool-actions"><button id="regex-copy" type="button" class="btn" disabled data-i18n="uiText.s1cf83784"></button><button id="regex-download" type="button" class="btn" disabled data-i18n="uiText.s96f783d9"></button><button id="regex-json" type="button" class="btn" disabled data-i18n="uiText.s59ec9170"></button><button id="regex-use-result" type="button" class="btn" disabled data-i18n="uiText.se89b4867"></button></div></section>
  </div>
  <section class="tool-card"><h2 data-i18n="uiText.sdd81c65a"></h2><div class="tool-actions"><button id="regex-previous" type="button" class="btn" disabled data-i18n="uiText.sead1fb48"></button><span id="regex-current" class="tool-note"></span><button id="regex-next" type="button" class="btn" disabled data-i18n="uiText.sdce2da08"></button></div><p id="regex-match-notice" class="tool-note"></p><div class="regex-table-scroll"><table class="tool-table"><thead><tr><th>#</th><th data-i18n="uiText.sa9a900c5"></th><th data-i18n="uiText.s57b2ca35"></th><th data-i18n="uiText.sef8b6805"></th></tr></thead><tbody id="regex-match-rows"></tbody></table></div><p id="regex-page-info" class="tool-note"></p><h3 class="regex-capture-title" data-i18n="uiText.s8fb9d63e"></h3><div id="regex-captures" class="regex-capture-scroll"></div><p class="tool-note" data-i18n="uiText.s766669f0"></p></section>
  <div class="tool-grid">
    <section class="tool-card"><h2 data-i18n="uiText.s1d2f6fb4"></h2><label for="regex-rule-search" data-i18n="uiText.sd5f26770"></label><input id="regex-rule-search" type="search" data-i18n-placeholder="uiText.s54272469"><p class="tool-note" data-i18n="uiText.s1fd087ec"></p><div id="regex-rule-list" class="regex-rule-list"></div><div id="regex-rule-detail" class="regex-rule-detail"></div></section>
    <section class="tool-card"><h2 data-i18n="uiText.s56c39920"></h2><table class="tool-table"><tbody>
      <tr><td><code>.</code> / <code>\\d \\w \\s</code></td><td data-i18n="uiText.sf4dd052c"></td></tr>
      <tr><td><code>[abc] [^abc] [a-z]</code></td><td data-i18n="uiText.sd2f3d8b4"></td></tr>
      <tr><td><code>^ $ \\b</code></td><td data-i18n="uiText.s72ffa07a"></td></tr>
      <tr><td><code>* + ? {n,m}</code></td><td data-i18n="uiText.s40d910ca"></td></tr>
      <tr><td><code>(a) (?:a) a|b</code></td><td data-i18n="uiText.sc6e1baa9"></td></tr>
      <tr><td><code>(?&lt;name&gt;a) \\k&lt;name&gt;</code></td><td data-i18n="uiText.sdf3bfd89"></td></tr>
      <tr><td><code>(?=a) (?!a) (?&lt;=a) (?&lt;!a)</code></td><td data-i18n="uiText.sd8949aca"></td></tr>
      <tr><td><code>\\p{Script=Han}</code></td><td data-i18n="uiText.s6e50e010"></td></tr>
    </tbody></table><p class="tool-note" data-i18n="uiText.s4db267f9"></p><p class="tool-note" data-i18n="uiText.sd7adf1e7"></p></section>
  </div>`;
const regexError=document.createElement('details');regexError.id='regex-error-detail';regexError.hidden=true;regexError.innerHTML='<summary data-i18n="cron.technicalDetails"></summary><pre id="regex-error-raw" dir="ltr"></pre>';$('regex-status').after(regexError);
mountTool('regex');
let result,lastState={status:'idle'},hasRun=false,stale=false,active=0,requestKey,selectedRule,suppressChanges=false;
const setDoc=(editor,text)=>{if(editor.state.doc.toString()!==text)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text}});};
const byteSize=text=>new TextEncoder().encode(text).length;
const size=n=>n<1024?`${n} B`:n<1024**2?`${(n/1024).toFixed(1)} KiB`:`${(n/1024**2).toFixed(2)} MiB`;
const text=(node,value)=>{node.textContent=value;return node;};
const el=(name,value,className)=>{const node=document.createElement(name);if(value!==undefined)node.textContent=value;if(className)node.className=className;return node;};
class EmptyMatch extends WidgetType {
  constructor(selected){super();this.selected=selected;}
  eq(other){return this.selected===other.selected;}
  toDOM(){const node=el('span','',`regex-empty-match${this.selected?' regex-selected':''}`);node.setAttribute('aria-hidden','true');return node;}
}
const markMatches=StateEffect.define();
const matchField=StateField.define({
  create:()=>Decoration.none,
  update(value,transaction) {
    if(transaction.docChanged) value=Decoration.none;
    for(const effect of transaction.effects) if(effect.is(markMatches)) {
      value=Decoration.set(effect.value.map(range=>range.from===range.to?Decoration.widget({widget:new EmptyMatch(range.selected),side:1}).range(range.from):Decoration.mark({class:`regex-match${range.selected?' regex-selected':''}`}).range(range.from,range.to)),true);
    }
    return value;
  },provide:field=>EditorView.decorations.from(field)
});
const source=createEditor($('regex-source'),{onChange:()=>inputChanged()});
source.dispatch({effects:StateEffect.appendConfig.of([matchField,EditorState.transactionFilter.of(transaction=> {
  if(!transaction.docChanged || byteSize(transaction.newDoc.toString())<=limits.input)return transaction;
  notify(t('uiText.s97298d85'));return [];
})])});
const replacement=createEditor($('regex-replacement'),{onChange:()=>inputChanged()});
replacement.dispatch({effects:StateEffect.appendConfig.of(EditorState.transactionFilter.of(transaction=> {
  if(!transaction.docChanged || byteSize(transaction.newDoc.toString())<=limits.replacement)return transaction;
  notify(t('uiText.s58b78d61'));return [];
}))});
const output=createEditor($('regex-output'),{readOnly:true});
const controller=createConversionController({createWorker:()=>new Worker(new URL('./tools/regex/worker.js',import.meta.url),{type:'module'}),timeoutMs:2000,onState:render});
const flagNames={d:['分组位置','Capture indices'],g:['全局匹配','Global'],i:['忽略大小写','Ignore case'],m:['多行锚点','Multiline'],s:['点匹配换行','Dot all'],u:['Unicode','Unicode'],v:['Unicode 集合','Unicode sets'],y:['粘连匹配','Sticky']};
function renderFlags() {
  const summary=$('regex-active-flags');if(summary)summary.textContent=t('polishShell.flags',{flags:$('regex-flags').value||'—'});
  $('regex-flag-options').replaceChildren(...Object.entries(flagNames).map(([flag,name])=> {
    const label=el('label'), checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=flag;checkbox.checked=$('regex-flags').value.includes(flag);
    let supported=true;try {new RegExp('',flag);}catch {supported=false;}
    checkbox.disabled=!supported;label.title=tr(...name)+(supported?'':t('uiText.s111dd7a2'));
    label.append(checkbox,document.createTextNode(flag));
    checkbox.addEventListener('change',()=> {
      let value=$('regex-flags').value.split('').filter(item=>item!==flag);
      if(checkbox.checked) {if(flag==='u' || flag==='v')value=value.filter(item=>item!==(flag==='u'?'v':'u'));value.push(flag);}
      $('regex-flags').value=value.join('');renderFlags();inputChanged();
    });return label;
  }));
  const common=$('regex-common-flags');
  if(common){
    for(const label of common.querySelectorAll('label'))label.remove();
    const labels=[...$('regex-flag-options').children].filter(label=>['g','i','m'].includes(label.querySelector('input').value));for(const label of labels){const flag=label.querySelector('input').value;label.lastChild.textContent=flag;label.querySelector('input').setAttribute('aria-label',flag+' · '+tr(...flagNames[flag]));}common.prepend(...labels);const help=$('regex-flag-help');if(help)help.textContent=['g','i','m'].map(flag=>flag+' · '+tr(...flagNames[flag])).join(' / ');
  }
}
function request() {return {pattern:$('regex-pattern').value,flags:$('regex-flags').value,input:source.state.doc.toString(),replacement:replacement.state.doc.toString(),operation:$('regex-operation').value,extractGroup:$('regex-group').value};}
function execute(auto=false) {
  if(suppressChanges)return;
  const next=request(),key=JSON.stringify(next);
  if(key!==requestKey)active=0;requestKey=key;
  hasRun=true;stale=false;
  $('regex-input-info').textContent=`${size(byteSize(source.state.doc.toString()))} · UTF-8`;
  if(auto)controller.invalidate();
  controller.process(next,{auto,wait:350});
}
function inputChanged() {
  if(suppressChanges)return;
  active=0;
  if($('regex-auto').checked)execute(true);else {stale=hasRun;controller.invalidate();$('regex-input-info').textContent=`${size(byteSize(source.state.doc.toString()))} · UTF-8`;}
}
function updateHighlights() {
  let ranges=(result?.highlightRanges || []).map((range,index)=>({...range,selected:index===active}));
  if(result?.matches[active] && active>=limits.highlights) {
    const match=result.matches[active];ranges=ranges.slice(0,limits.highlights-1).concat({from:match.index,to:match.end,selected:true});
  }
  source.dispatch({effects:markMatches.of(ranges)});
}
function groupOptions() {
  const previous=$('regex-group').value, options=[['0',t('uiText.sfc8e66e5')]];
  const match=result?.matches[0];
  if(match) {
    for(const group of match.captures)options.push([String(group.number),`$${group.number}`]);
    for(const name of Object.keys(match.namedGroups))options.push([`name:${name}`,`$<${name}>`]);
  }
  // Keep the chosen capture while a new task is pending, so changing the source
  // does not silently change extraction back to the whole match.
  if(previous && !options.some(([value])=>value===previous))options.push([previous,previous.startsWith('name:')?`$<${previous.slice(5)}>`:`$${previous}`]);
  $('regex-group').replaceChildren(...options.map(([value,name])=> {const option=el('option',name);option.value=value;return option;}));
  $('regex-group').value=previous || '0';
}
function valuePreview(value) {return value===undefined?t('uiText.s38671e10'):value===''?t('uiText.sacd1d14e'):value.length>2000?`${value.slice(0,2000)}… ${t('uiText.sc8aa4c9d')}`:value;}
function showMatch(index,focus=true) {
  if(!result?.matches.length)return;
  active=(index+result.matches.length)%result.matches.length;renderMatches();updateHighlights();
  if(focus) {const match=result.matches[active];source.dispatch({selection:{anchor:match.index,head:match.end},effects:EditorView.scrollIntoView(match.index,{y:'center'})});source.focus();}
}
function renderMatches() {
  const count=result?.matches.length || 0;
  $('regex-previous').disabled=$('regex-next').disabled=count===0;
  $('regex-current').textContent=count?t('uiText.sde3d8e4e',{p0:active+1,p1:count}):t(result?'direct.developer.regexNoMatches':'direct.developer.regexNotRun');
  $('regex-match-notice').textContent=result?.truncated?t('uiText.sad2bc38e'):result && count>limits.highlights?t('uiText.s698d5880'):'';
  const start=Math.floor(active/50)*50, visible=result?.matches.slice(start,start+50) || [];
  $('regex-match-rows').replaceChildren(...visible.map((match,offset)=> {
    const index=start+offset,row=document.createElement('tr'),select=el('button',String(index+1),'regex-match-select');select.type='button';select.setAttribute('aria-label',t('uiText.s8034779b',{p0:index+1}));
    if(index===active) {row.className='is-selected';select.setAttribute('aria-current','true');}
    select.addEventListener('click',()=>showMatch(index));const cell=document.createElement('td');cell.append(select);
    row.append(cell,el('td',`${match.line}:${match.column}`),el('td',`[${match.index}, ${match.end})`),el('td',valuePreview(match.value),'regex-value'));return row;
  }));
  $('regex-page-info').textContent=count?t('uiText.sdc00f0bf',{p0:start+1,p1:Math.min(start+50,count),p2:count}):'';
  const match=result?.matches[active],groups=match?[...match.captures.map(group=>({name:`$${group.number}`,...group})),...Object.entries(match.namedGroups).map(([name,group])=>({name:`$<${name}>`,...group}))]:[];
  document.querySelector('.regex-capture-title').hidden=!groups.length;$('regex-captures').hidden=!groups.length;
  if(!groups.length) {$('regex-captures').replaceChildren();return;}
  const table=el('table',undefined,'tool-table'),head=document.createElement('thead'),header=document.createElement('tr');
  header.append(...[t('uiText.s2fbb5e61'),t('uiText.sb01bbc1a'),t('uiText.sa311e772')].map(title=>el('th',title)));head.append(header);const body=document.createElement('tbody');
  for(const group of groups) {
    const row=document.createElement('tr');row.append(el('td',group.name),el('td',valuePreview(group.value),'regex-value'),el('td',group.start===undefined?'—':`[${group.start}, ${group.end})`));body.append(row);
  }
  table.append(head,body);$('regex-captures').replaceChildren(table);
}
function render(state) {
  const retainPreview=state.status==='pending'&&Boolean(result||lastState.status==='pending');
  $('regex-status').dataset.taskState=state.status;
  lastState=state;result=state.status==='ready'?state:undefined;
  if(result)active=Math.min(active,Math.max(0,result.matches.length-1));
  $('regex-cancel').hidden=state.status!=='pending';$('regex-cancel').disabled=state.status!=='pending';
  for(const id of ['regex-copy','regex-download','regex-json'])$(id).disabled=!result;
  $('regex-use-result').disabled=!result || result.outputBytes>limits.input;
  if(!retainPreview){setDoc(output,result?.preview || '');
  $('regex-preview-info').textContent=result?`${size(result.outputBytes)} · ${result.durationMs} ms · `+(result.previewTruncated?t('uiText.s1c6d1b0'):t('uiText.s1b52df0')):'';}
  const inputBytes=byteSize(source.state.doc.toString());
  $('regex-status').textContent=state.status==='pending'?t('uiText.sa1ea6cd3'):state.status==='ready'?t('uiText.s471ea5e4',{p0:state.matches.length,p1:state.truncated?'+' :'',p2:state.durationMs}):state.status==='error'?`${t(state.code==='TaskTimeout'?'office.timeout':'common.error')}${state.position===undefined?'':t('uiText.s2bd66e',{p0:state.field,p1:state.position+1})}`:state.status==='cancelled'?t('uiText.s5d30e9f9'):inputBytes>256*1024?t('uiText.s4ad52344'):t('uiText.s9dc92a08');
  if(state.status==='idle'&&stale)$('regex-status').textContent=t('direct.developer.regexStale');
  $('regex-error-detail').hidden=state.status!=='error';$('regex-error-raw').textContent=state.status==='error'?state.message||state.code||'':'';
  $('regex-status').classList.toggle('tool-error',state.status==='error');
  $('regex-locate').hidden=state.status!=='error' || state.position===undefined;
  if(retainPreview){for(const button of document.querySelectorAll('#regex-previous,#regex-next,#regex-match-rows button'))button.disabled=true;}else {groupOptions();renderMatches();updateHighlights();}
}
function showRule(rule) {
  if(!rule) {$('regex-rule-detail').replaceChildren();return;}
  const wrap=$('regex-rule-detail');wrap.replaceChildren(el('h3',tr(...rule.name)),el('p',tr(...rule.description)),el('p',tr(...rule.limitation),'tool-note'),el('code',rule.pattern));
  wrap.append(el('p',`${t('uiText.sb0d22288')}: ${rule.positive.map(sample=>JSON.stringify(sample)).join(' · ')}`,'tool-note'),el('p',`${t('uiText.s7c33504c')}: ${rule.negative.map(sample=>JSON.stringify(sample)).join(' · ')}`,'tool-note'));
}
function renderRules() {
  const found=findRules($('regex-rule-search').value,t);
  $('regex-rule-list').replaceChildren(...found.map(rule=> {
    const button=el('button',tr(...rule.name),'regex-rule');button.type='button';button.dataset.rule=rule.id;button.title=tr(...rule.description);button.setAttribute('aria-pressed',String(selectedRule?.id===rule.id));
    button.append(el('small',tr(...rule.tags)));button.addEventListener('click',()=> {
      if(($('regex-pattern').value!==$('regex-pattern').defaultValue||$('regex-flags').value!==$('regex-flags').defaultValue)&&($('regex-pattern').value!==rule.pattern||$('regex-flags').value!==rule.flags)&&!confirm(t('office.presetConfirm')))return;
      selectedRule=rule;$('regex-pattern').value=rule.pattern;$('regex-flags').value=rule.flags;renderFlags();renderRules();inputChanged();
    });return button;
  }));
  if(!found.length)$('regex-rule-list').append(el('p',t('uiText.s4071c80a'),'tool-note'));
  showRule(selectedRule);
}
function operationChanged() {
  regexAction();
  $('regex-replacement-panel').hidden=$('regex-operation').value!=='replace';$('regex-group-field').hidden=$('regex-operation').value!=='extract';
  $('regex-group-field').closest('.tool-fields').hidden=$('regex-operation').value!=='extract';
  if($('regex-operation').value!=='extract')$('regex-group').value='0';inputChanged();
}
$('regex-pattern').addEventListener('input',inputChanged);
$('regex-flags').addEventListener('input',()=> {renderFlags();inputChanged();});
$('regex-operation').addEventListener('change',operationChanged);
$('regex-group').addEventListener('change',inputChanged);
$('regex-run').addEventListener('click',()=>execute());
$('regex-cancel').addEventListener('click',()=>controller.cancel());
$('regex-auto').addEventListener('change',()=> {$('regex-auto').checked?execute(true):controller.invalidate();});
$('regex-clear').addEventListener('click',()=> {if(source.state.doc.length)setDoc(source,'');else controller.invalidate();});
$('regex-locate').addEventListener('click',()=> {const field=$(lastState.field==='flags'?'regex-flags':'regex-pattern');field.focus();field.setSelectionRange(lastState.position,Math.min(lastState.position+1,field.value.length));});
$('regex-previous').addEventListener('click',()=>showMatch(active-1));$('regex-next').addEventListener('click',()=>showMatch(active+1));
$('regex-copy').addEventListener('click',async()=> {const current=result;if(!current)return;const content=await current.blob.text();if(current===result)await copyText(content);});
$('regex-download').addEventListener('click',()=> {if(result)downloadText(result.blob,result.operation==='replace'?'regex-replaced.txt':'regex-extracted.txt');});
$('regex-json').addEventListener('click',()=> {if(result)downloadText(result.jsonBlob,'regex-matches.json','application/json');});
$('regex-use-result').addEventListener('click',async()=> {
  const current=result;if(!current || current.outputBytes>limits.input)return;
  const content=await current.blob.text();if(current!==result)return;
  suppressChanges=true;setDoc(source,content);suppressChanges=false;inputChanged();
});
$('regex-rule-search').addEventListener('input',renderRules);
onLanguageChange(()=> {renderFlags();renderRules();render(lastState);source.contentDOM.setAttribute('aria-label',t('uiText.sb2ece352'));replacement.contentDOM.setAttribute('aria-label',t('uiText.sf0424567'));output.contentDOM.setAttribute('aria-label',t('uiText.s504af044'));});
renderFlags();renderRules();localize();render(lastState);$('regex-input-info').textContent='0 B · UTF-8';
replacement.contentDOM.setAttribute('aria-label',t('uiText.sf0424567'));
source.contentDOM.setAttribute('aria-label',t('uiText.sb2ece352'));
window.addEventListener('pagehide',()=>controller.cancel());

const regexHeading=document.querySelector('.page-heading');regexHeading.className='tool-heading';regexHeading.querySelector('h1').removeAttribute('data-zh');regexHeading.querySelector('h1').removeAttribute('data-en');regexHeading.querySelector('h1').setAttribute('data-i18n','common.regex');
regexHeading.querySelector('p').removeAttribute('data-zh');regexHeading.querySelector('p').removeAttribute('data-en');regexHeading.querySelector('p').setAttribute('data-i18n','ux.purpose_regex');
function regexOrderTask(useExample=false){
 suppressChanges=true;$('regex-pattern').value='ORDER-\\d+';$('regex-flags').value='g';$('regex-operation').value='extract';$('regex-group').value='0';if(useExample)setDoc(source,'Alice: ORDER-1024\nBob: ORDER-2048');suppressChanges=false;renderFlags();operationChanged();execute();
}
const regexGuide=addTaskGuide('regex',['match','extract','replace'].map(id=>({id,key:id==='match'?'office.match':id==='extract'?'office.extractMatches':'common.replace'})),{hasContent:()=>source.state.doc.length>0||replacement.state.doc.length>0||Boolean(result)||['regex-pattern','regex-flags'].some(id=>$(id).value!==$(id).defaultValue),choose:task=>{$('regex-operation').value=task;operationChanged();},example:()=>{regexOrderTask(true);regexGuide.select('extract');}});
const flagField=$('regex-flags').closest('.field');const regexHelp=$('regex-task-match').closest('section').querySelector('.task-help');regexHelp.append(flagField,$('regex-auto').closest('label'),$('regex-run').closest('section').querySelector(':scope > p.tool-note'));
const regexPurpose=regexHeading.querySelector('p');regexPurpose.textContent=t('ux.purpose_regex');regexHeading.append(regexPurpose);
$('regex-operation').closest('.field').hidden=true;$('regex-group-field').closest('.tool-fields').hidden=true;
$('regex-pattern').after($('regex-locate'));
for(const element of [regexHeading]){const translate=()=>{for(const node of element.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);};onLanguageChange(translate);translate();}

$('regex-operation').addEventListener('change',()=>regexGuide.select($('regex-operation').value));

actionArea($('regex-run').closest('.tool-actions'),$('regex-status'));

const commonFlags=document.createElement('div');commonFlags.className='regex-flags';commonFlags.id='regex-common-flags';const patternTools=document.createElement('div');patternTools.className='regex-pattern-tools';const patternLabel=document.querySelector('label[for=regex-pattern]');patternLabel.before(patternTools);const activeFlags=el('span','','tool-note');activeFlags.id='regex-active-flags';activeFlags.dir='ltr';patternTools.append(patternLabel,activeFlags,commonFlags);const flagHelp=document.createElement('p');flagHelp.id='regex-flag-help';flagHelp.className='tool-note';regexHelp.append(flagHelp);renderFlags();
for(const card of [...$('regex-rule-list').closest('.tool-grid').children]){const details=document.createElement('details'),summary=document.createElement('summary'),heading=card.querySelector('h2');summary.append(heading);details.append(summary);details.append(...card.childNodes);card.append(details);}
function regexAction(){$('regex-run').textContent=t($('regex-operation').value==='match'?'office.match':$('regex-operation').value==='extract'?'office.extractMatches':'common.replace');}
$('regex-run').removeAttribute('data-zh');$('regex-run').removeAttribute('data-en');$('regex-run').removeAttribute('data-i18n');onLanguageChange(regexAction);regexAction();

regexHelp.append($('regex-example'));

const rulesPanel=$('regex-rule-list').closest('section');rulesPanel.id='regex-rules-panel';rulesPanel.setAttribute('popover','auto');document.body.append(rulesPanel);const rulesOpen=document.createElement('button');rulesOpen.id='regex-rules-open';rulesOpen.type='button';rulesOpen.setAttribute('popovertarget',rulesPanel.id);rulesOpen.dataset.i18n='ux.commonRules';rulesOpen.textContent=t('ux.commonRules');commonFlags.append(rulesOpen);rulesPanel.addEventListener('toggle',event=>{if(event.newState==='open'){rulesPanel.querySelector('details').open=true;$('regex-rule-search').focus();}});
const textLink=document.createElement('a');textLink.href='./text.html#extract';textLink.dataset.i18n='ux.openTextTool';textLink.textContent=t('ux.openTextTool');textLink.className='tool-note';rulesPanel.prepend(textLink);

const regexGrid=$('regex-source').closest('.tool-grid');regexGrid.classList.add('editor-workspace');
const matchDetails=$('regex-match-rows').closest('section'),matchDisclosure=document.createElement('details'),matchSummary=document.createElement('summary');matchSummary.append(matchDetails.querySelector('h2'));matchDisclosure.append(matchSummary,...matchDetails.childNodes);matchDetails.append(matchDisclosure);
$('regex-run').closest('section').classList.add('regex-workspace-controls');

matchDisclosure.before($('regex-previous').closest('.tool-actions'));

const extractHelp=document.createElement('p');extractHelp.className='tool-note';extractHelp.dataset.i18n='refinement.regexExtractHelp';$('regex-group-field').append(extractHelp);translateDOM(extractHelp.parentElement);
