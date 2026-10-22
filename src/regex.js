import {actionArea} from './tools/shared/workspace.js';
import { addTaskGuide } from './tools/shared/task-guide.js';
import { t } from './i18n.js';
import {EditorState,StateEffect,StateField} from '@codemirror/state';
import {Decoration,EditorView,WidgetType} from '@codemirror/view';
import {createConversionController} from './tools/convert/controller.js';
import {limits} from './tools/regex/core.js';
import {findRules} from './tools/regex/rules.js';
import {tr,copyText,downloadText,notify,mountTool,localize,createEditor} from './tools/shared/page.js';
import {onLanguageChange} from './i18n.js';
import './tools/regex/style.css';

const $=id=>document.getElementById(id);
$('tool-root').innerHTML=`
  <div class="page-heading"><h1 data-zh="正则工具" data-en="Regular expressions"></h1><p data-zh="JavaScript RegExp · 本地匹配、提取与替换" data-en="JavaScript RegExp · Local matching, extraction and replacement"></p></div>
  <section class="tool-card">
    <div class="tool-fields">
      <div class="field regex-pattern-field"><label for="regex-pattern" data-zh="模式（不含 / 分隔符）" data-en="Pattern (without / delimiters)"></label><textarea id="regex-pattern" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off">(?&lt;word&gt;\\w+)</textarea></div>
      <div class="field regex-flags-field"><label for="regex-flags" data-zh="标志" data-en="Flags"></label><input id="regex-flags" value="g" spellcheck="false" autocapitalize="off" autocomplete="off"><div id="regex-flag-options" class="regex-flags"></div></div>
    </div>
    <div class="tool-fields">
      <div class="field"><label for="regex-operation" data-zh="操作" data-en="Operation"></label><select id="regex-operation"><option value="match" data-zh="匹配" data-en="Match"></option><option value="extract" data-zh="提取" data-en="Extract"></option><option value="replace" data-zh="替换" data-en="Replace"></option></select></div>
      <div class="field" id="regex-group-field" hidden><label for="regex-group" data-zh="提取分组" data-en="Extract group"></label><select id="regex-group"><option value="0" data-zh="完整匹配 $&" data-en="Whole match $&"></option></select></div>
    </div>
    <div id="regex-replacement-panel" hidden><label class="regex-editor-label" for="regex-replacement" data-zh="替换文本（原生字符串 token）" data-en="Replacement (native string tokens)"></label><div id="regex-replacement" class="regex-small-editor"></div><p class="tool-note" data-zh="$$ → $ · $& → 完整匹配 · $1…$99 → 编号分组 · $<name> → 命名分组 · $\x60 / $' → 前文 / 后文。未参与分组替换为空串；不执行代码。" data-en="$$ → $ · $& → whole match · $1…$99 → numbered capture · $<name> → named capture · $\x60 / $' → prefix / suffix. Nonparticipating captures become empty strings; no code is executed."></p></div>
    <div class="tool-actions"><button id="regex-run" type="button" class="primary" data-zh="运行" data-en="Run"></button><button id="regex-cancel" type="button" class="btn" disabled data-zh="取消" data-en="Cancel"></button><label class="check-label"><input id="regex-auto" type="checkbox" checked><span data-zh="小文本自动运行" data-en="Auto-run small text"></span></label><button id="regex-locate" type="button" class="btn" hidden data-zh="定位语法错误" data-en="Locate syntax error"></button></div>
    <p class="tool-note" data-zh="输入 ≤ 10 MiB · 模式 / 替换各 ≤ 16 KiB · 输出 ≤ 100 MiB · 每次运行 2 秒上限 · ≤ 256 KiB 自动运行，350 ms 防抖 · 大文本请手动运行。" data-en="Input ≤ 10 MiB · Pattern/replacement ≤ 16 KiB each · Output ≤ 100 MiB · 2-second task deadline · Auto-run ≤ 256 KiB after 350 ms; run larger text manually."></p>
    <div id="regex-status" class="tool-status" role="status" aria-live="polite"></div>
  </section>
  <div class="tool-grid">
    <section class="tool-card"><h2 data-zh="输入文本" data-en="Input text"></h2><div id="regex-source"></div><div class="tool-actions"><button id="regex-clear" class="btn" type="button" data-zh="清空输入" data-en="Clear input"></button><span id="regex-input-info" class="tool-note"></span></div><p class="tool-note" data-zh="高亮最多 1000 处；行、列从 1 开始，偏移从 0 开始，列与偏移按 UTF-16 码元计数。" data-en="Highlights up to 1000 matches. Lines/columns start at 1; offsets start at 0. Columns and offsets count UTF-16 code units."></p></section>
    <section class="tool-card"><h2 id="regex-output-title" data-zh="结果" data-en="Result"></h2><div id="regex-output"></div><p id="regex-preview-info" class="tool-note"></p><div class="tool-actions"><button id="regex-copy" type="button" class="btn" disabled data-zh="复制全文" data-en="Copy full text"></button><button id="regex-download" type="button" class="btn" disabled data-zh="下载完整文本" data-en="Download full text"></button><button id="regex-json" type="button" class="btn" disabled data-zh="导出匹配 JSON" data-en="Export matches as JSON"></button><button id="regex-use-result" type="button" class="btn" disabled data-zh="结果作为输入" data-en="Use result as input"></button></div></section>
  </div>
  <section class="tool-card"><h2 data-zh="匹配与分组" data-en="Matches and captures"></h2><div class="tool-actions"><button id="regex-previous" type="button" class="btn" disabled data-zh="上一处" data-en="Previous"></button><span id="regex-current" class="tool-note"></span><button id="regex-next" type="button" class="btn" disabled data-zh="下一处" data-en="Next"></button></div><p id="regex-match-notice" class="tool-note"></p><div class="regex-table-scroll"><table class="tool-table"><thead><tr><th>#</th><th data-zh="行 : 列" data-en="Line : column"></th><th data-zh="范围 [起, 止)" data-en="Range [start, end)"></th><th data-zh="完整匹配" data-en="Whole match"></th></tr></thead><tbody id="regex-match-rows"></tbody></table></div><p id="regex-page-info" class="tool-note"></p><h3 class="regex-capture-title" data-zh="当前匹配的分组" data-en="Captures in the selected match"></h3><div id="regex-captures" class="regex-capture-scroll"></div><p class="tool-note" data-zh="列表中每个值最多预览 2000 字符，JSON 保留完整值并以 defined / null 区分未参与分组与空字符串。每页 50 条，可用上一处 / 下一处浏览全部保留匹配。" data-en="Each table value previews up to 2000 characters. JSON preserves full values; defined / null distinguishes nonparticipating captures from empty strings. 50 matches per page; Previous/Next browses all retained matches."></p></section>
  <div class="tool-grid">
    <section class="tool-card"><h2 data-zh="本地规则库 · 30 条" data-en="Local rule library · 30 rules"></h2><label for="regex-rule-search" data-zh="搜索名称、标签或说明" data-en="Search names, tags or descriptions"></label><input id="regex-rule-search" type="search" data-placeholder-zh="例如：邮箱、IP、日期" data-placeholder-en="For example: email, IP, date"><p class="tool-note" data-zh="选择规则只修改模式和标志；说明与合成样本仅供参考。格式匹配不证明真实性、有效性或安全性。" data-en="Selecting a rule changes only pattern and flags. Notes and synthetic samples are references. A format match proves neither authenticity, validity nor security."></p><div id="regex-rule-list" class="regex-rule-list"></div><div id="regex-rule-detail" class="regex-rule-detail"></div></section>
    <section class="tool-card"><h2 data-zh="语法速查" data-en="Syntax quick reference"></h2><table class="tool-table"><tbody>
      <tr><td><code>.</code> / <code>\\d \\w \\s</code></td><td data-zh="单字符 / 数字、单词、空白" data-en="Any character / digit, word character, whitespace"></td></tr>
      <tr><td><code>[abc] [^abc] [a-z]</code></td><td data-zh="字符集、排除、范围" data-en="Character set, negation, range"></td></tr>
      <tr><td><code>^ $ \\b</code></td><td data-zh="开头、结尾、单词边界" data-en="Start, end, word boundary"></td></tr>
      <tr><td><code>* + ? {n,m}</code></td><td data-zh="次数；追加 ? 为懒惰匹配" data-en="Repetition; append ? for lazy matching"></td></tr>
      <tr><td><code>(a) (?:a) a|b</code></td><td data-zh="捕获、不捕获、或" data-en="Capture, noncapture, alternation"></td></tr>
      <tr><td><code>(?&lt;name&gt;a) \\k&lt;name&gt;</code></td><td data-zh="命名捕获、命名反向引用" data-en="Named capture, named backreference"></td></tr>
      <tr><td><code>(?=a) (?!a) (?&lt;=a) (?&lt;!a)</code></td><td data-zh="正向 / 负向前瞻与后顾" data-en="Positive / negative lookahead and lookbehind"></td></tr>
      <tr><td><code>\\p{Script=Han}</code></td><td data-zh="Unicode 属性，需 u 或 v" data-en="Unicode property; requires u or v"></td></tr>
    </tbody></table><p class="tool-note" data-zh="g 全局 · i 忽略大小写 · m 多行锚点 · s 点匹配换行 · u Unicode · v Unicode 集合 · y 粘连 · d 分组位置。u / v 互斥，支持能力以当前浏览器为准。没有 g 时仅保留首个匹配；y 仍要求从当前位置连续匹配。" data-en="g global · i ignore case · m multiline anchors · s dotAll · u Unicode · v Unicode sets · y sticky · d capture indices. u / v are exclusive; support depends on this browser. Without g, only the first match is retained; y still requires matching at the current position."></p><p class="tool-note" data-zh="不同引擎（Java / Python / PCRE）语法可能不同。复杂模式可能回溯耗时，运行于独立 Worker，取消或输入变化会立即终止旧任务。" data-en="Other engines (Java / Python / PCRE) may use different syntax. Complex patterns can backtrack slowly; tasks run in a separate Worker, terminated when cancelled or inputs change."></p></section>
  </div>`;
mountTool('regex');
let result,lastState={status:'idle'},active=0,selectedRule,suppressChanges=false;
const setDoc=(editor,text)=>editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:text}});
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
  notify(tr('输入超过 10 MiB，未应用编辑','Input exceeds 10 MiB; edit was not applied'));return [];
})])});
const replacement=createEditor($('regex-replacement'),{onChange:()=>inputChanged()});
replacement.dispatch({effects:StateEffect.appendConfig.of(EditorState.transactionFilter.of(transaction=> {
  if(!transaction.docChanged || byteSize(transaction.newDoc.toString())<=limits.replacement)return transaction;
  notify(tr('替换文本超过 16 KiB，未应用编辑','Replacement exceeds 16 KiB; edit was not applied'));return [];
}))});
const output=createEditor($('regex-output'),{readOnly:true});
const controller=createConversionController({createWorker:()=>new Worker(new URL('./tools/regex/worker.js',import.meta.url),{type:'module'}),timeoutMs:2000,onState:render});
const flagNames={d:['分组位置','Capture indices'],g:['全局匹配','Global'],i:['忽略大小写','Ignore case'],m:['多行锚点','Multiline'],s:['点匹配换行','Dot all'],u:['Unicode','Unicode'],v:['Unicode 集合','Unicode sets'],y:['粘连匹配','Sticky']};
function renderFlags() {
  $('regex-flag-options').replaceChildren(...Object.entries(flagNames).map(([flag,name])=> {
    const label=el('label'), checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=flag;checkbox.checked=$('regex-flags').value.includes(flag);
    let supported=true;try {new RegExp('',flag);}catch {supported=false;}
    checkbox.disabled=!supported;label.title=tr(...name)+(supported?'':tr('（当前浏览器不支持）',' (unsupported by this browser)'));
    label.append(checkbox,document.createTextNode(flag));
    checkbox.addEventListener('change',()=> {
      let value=$('regex-flags').value.split('').filter(item=>item!==flag);
      if(checkbox.checked) {if(flag==='u' || flag==='v')value=value.filter(item=>item!==(flag==='u'?'v':'u'));value.push(flag);}
      $('regex-flags').value=value.join('');renderFlags();inputChanged();
    });return label;
  }));
}
function request() {return {pattern:$('regex-pattern').value,flags:$('regex-flags').value,input:source.state.doc.toString(),replacement:replacement.state.doc.toString(),operation:$('regex-operation').value,extractGroup:$('regex-group').value};}
function execute(auto=false) {
  if(suppressChanges)return;
  $('regex-input-info').textContent=`${size(byteSize(source.state.doc.toString()))} · UTF-8`;
  controller.process(request(),{auto,wait:350});
}
function inputChanged() {
  if(suppressChanges)return;
  if($('regex-auto').checked)execute(true);else {controller.invalidate();$('regex-input-info').textContent=`${size(byteSize(source.state.doc.toString()))} · UTF-8`;}
}
function updateHighlights() {
  let ranges=(result?.highlightRanges || []).map((range,index)=>({...range,selected:index===active}));
  if(result?.matches[active] && active>=limits.highlights) {
    const match=result.matches[active];ranges=ranges.slice(0,limits.highlights-1).concat({from:match.index,to:match.end,selected:true});
  }
  source.dispatch({effects:markMatches.of(ranges)});
}
function groupOptions() {
  const previous=$('regex-group').value, options=[['0',tr('完整匹配 $&','Whole match $&')]];
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
function valuePreview(value) {return value===undefined?tr('undefined（未参与）','undefined (did not participate)'):value===''?tr('""（空字符串）','"" (empty string)'):value.length>2000?`${value.slice(0,2000)}… ${tr('（值已截短）','(value truncated)')}`:value;}
function showMatch(index,focus=true) {
  if(!result?.matches.length)return;
  active=(index+result.matches.length)%result.matches.length;renderMatches();updateHighlights();
  if(focus) {const match=result.matches[active];source.dispatch({selection:{anchor:match.index,head:match.end},effects:EditorView.scrollIntoView(match.index,{y:'center'})});source.focus();}
}
function renderMatches() {
  const count=result?.matches.length || 0;
  $('regex-previous').disabled=$('regex-next').disabled=count===0;
  $('regex-current').textContent=count?tr(`第 ${active+1} / ${count} 处`,`Match ${active+1} / ${count}`):tr('暂无匹配','No matches');
  $('regex-match-notice').textContent=result?.truncated?tr('已截断：仅保留前 10000 条；提取和 JSON 仅含保留匹配，替换已禁用。','Truncated: only the first 10000 matches are retained. Extraction/JSON include retained matches; replacement is disabled.'):result && count>limits.highlights?tr('高亮最多 1000 处；仍可导航全部匹配。','Highlights are limited to 1000; all matches remain navigable.'):'';
  const start=Math.floor(active/50)*50, visible=result?.matches.slice(start,start+50) || [];
  $('regex-match-rows').replaceChildren(...visible.map((match,offset)=> {
    const index=start+offset,row=document.createElement('tr'),select=el('button',String(index+1),'regex-match-select');select.type='button';select.setAttribute('aria-label',tr(`定位第 ${index+1} 处匹配`,`Go to match ${index+1}`));
    if(index===active) {row.className='is-selected';select.setAttribute('aria-current','true');}
    select.addEventListener('click',()=>showMatch(index));const cell=document.createElement('td');cell.append(select);
    row.append(cell,el('td',`${match.line}:${match.column}`),el('td',`[${match.index}, ${match.end})`),el('td',valuePreview(match.value),'regex-value'));return row;
  }));
  $('regex-page-info').textContent=count?tr(`显示 ${start+1}–${Math.min(start+50,count)} / ${count}`,`Showing ${start+1}–${Math.min(start+50,count)} / ${count}`):'';
  const match=result?.matches[active],groups=match?[...match.captures.map(group=>({name:`$${group.number}`,...group})),...Object.entries(match.namedGroups).map(([name,group])=>({name:`$<${name}>`,...group}))]:[];
  if(!groups.length) {$('regex-captures').replaceChildren(el('p',tr('当前匹配没有捕获分组','No captures in the selected match'),'tool-note'));return;}
  const table=el('table',undefined,'tool-table'),head=document.createElement('thead'),header=document.createElement('tr');
  header.append(...[tr('分组','Capture'),tr('值 / 状态','Value / state'),tr('范围','Range')].map(title=>el('th',title)));head.append(header);const body=document.createElement('tbody');
  for(const group of groups) {
    const row=document.createElement('tr');row.append(el('td',group.name),el('td',valuePreview(group.value),'regex-value'),el('td',group.start===undefined?'—':`[${group.start}, ${group.end})`));body.append(row);
  }
  table.append(head,body);$('regex-captures').replaceChildren(table);
}
function render(state) {
  $('regex-status').dataset.taskState=state.status;
  lastState=state;result=state.status==='ready'?state:undefined;active=0;
  $('regex-cancel').disabled=state.status!=='pending';
  for(const id of ['regex-copy','regex-download','regex-json'])$(id).disabled=!result;
  $('regex-use-result').disabled=!result || result.outputBytes>limits.input;
  setDoc(output,result?.preview || '');
  $('regex-preview-info').textContent=result?`${size(result.outputBytes)} · ${result.durationMs} ms · `+(result.previewTruncated?tr('仅预览前 1 MiB；复制 / 下载使用完整结果','First 1 MiB preview only; copy/download uses the full result'):tr('完整预览','Full preview')):'';
  const inputBytes=byteSize(source.state.doc.toString());
  $('regex-status').textContent=state.status==='pending'?tr('正在运行，可随时取消…','Running… You can cancel at any time.'):state.status==='ready'?tr(`共 ${state.matches.length}${state.truncated?'+' :''} 处匹配 · ${state.durationMs} ms`,`${state.matches.length}${state.truncated?'+' :''} matches · ${state.durationMs} ms`):state.status==='error'?`${state.message}${state.position===undefined?'':tr(` · ${state.field==='pattern'?'模式':'标志'}第 ${state.position+1} 个位置`,` · ${state.field} position ${state.position+1}`)}`:state.status==='cancelled'?tr('任务已取消，结果已清除','Task cancelled; result cleared'):inputBytes>256*1024?tr('输入超过 256 KiB，请手动运行','Input exceeds 256 KiB; run manually'):tr('等待运行','Ready to run');
  $('regex-status').classList.toggle('tool-error',state.status==='error');
  $('regex-locate').hidden=state.status!=='error' || state.position===undefined;
  groupOptions();renderMatches();updateHighlights();
}
function showRule(rule) {
  if(!rule) {$('regex-rule-detail').replaceChildren();return;}
  const wrap=$('regex-rule-detail');wrap.replaceChildren(el('h3',tr(...rule.name)),el('p',tr(...rule.description)),el('p',tr(...rule.limitation),'tool-note'),el('code',rule.pattern));
  wrap.append(el('p',`${tr('合成匹配样本','Synthetic positive samples')}: ${rule.positive.map(sample=>JSON.stringify(sample)).join(' · ')}`,'tool-note'),el('p',`${tr('合成不匹配样本','Synthetic negative samples')}: ${rule.negative.map(sample=>JSON.stringify(sample)).join(' · ')}`,'tool-note'));
}
function renderRules() {
  const found=findRules($('regex-rule-search').value);
  $('regex-rule-list').replaceChildren(...found.map(rule=> {
    const button=el('button',tr(...rule.name),'regex-rule');button.type='button';button.dataset.rule=rule.id;button.title=tr(...rule.description);button.setAttribute('aria-pressed',String(selectedRule?.id===rule.id));
    button.append(el('small',tr(...rule.tags)));button.addEventListener('click',()=> {
      if(($('regex-pattern').value!==$('regex-pattern').defaultValue||$('regex-flags').value!==$('regex-flags').defaultValue)&&($('regex-pattern').value!==rule.pattern||$('regex-flags').value!==rule.flags)&&!confirm(t('office.presetConfirm')))return;
      selectedRule=rule;$('regex-pattern').value=rule.pattern;$('regex-flags').value=rule.flags;renderFlags();renderRules();inputChanged();
    });return button;
  }));
  if(!found.length)$('regex-rule-list').append(el('p',tr('没有匹配的规则','No matching rules'),'tool-note'));
  showRule(selectedRule);
}
function operationChanged() {
  $('regex-replacement-panel').hidden=$('regex-operation').value!=='replace';$('regex-group-field').hidden=$('regex-operation').value!=='extract';
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
onLanguageChange(()=> {renderFlags();renderRules();render(lastState);source.contentDOM.setAttribute('aria-label',tr('输入文本','Input text'));replacement.contentDOM.setAttribute('aria-label',tr('替换文本','Replacement'));output.contentDOM.setAttribute('aria-label',tr('结果','Result'));});
renderFlags();renderRules();localize();render(lastState);$('regex-input-info').textContent='0 B · UTF-8';
replacement.contentDOM.setAttribute('aria-label',tr('替换文本','Replacement'));
source.contentDOM.setAttribute('aria-label',tr('输入文本','Input text'));
window.addEventListener('pagehide',()=>controller.cancel());

const regexHeading=document.querySelector('.page-heading');regexHeading.className='tool-heading';regexHeading.querySelector('h1').removeAttribute('data-zh');regexHeading.querySelector('h1').removeAttribute('data-en');regexHeading.querySelector('h1').setAttribute('data-i18n','common.regex');
regexHeading.querySelector('p').removeAttribute('data-zh');regexHeading.querySelector('p').removeAttribute('data-en');regexHeading.querySelector('p').setAttribute('data-i18n','office.regexPurpose');
function regexOrderTask(useExample=false){
 suppressChanges=true;$('regex-pattern').value='ORDER-\\d+';$('regex-flags').value='g';$('regex-operation').value='extract';$('regex-group').value='0';if(useExample)setDoc(source,'Alice: ORDER-1024\nBob: ORDER-2048');suppressChanges=false;renderFlags();operationChanged();execute();
}
const regexGuide=addTaskGuide('regex',['match','extract','replace'].map(id=>({id,key:id==='match'?'office.match':`text.${id}`})),{hasContent:()=>source.state.doc.length>0||replacement.state.doc.length>0||Boolean(result)||['regex-pattern','regex-flags'].some(id=>$(id).value!==$(id).defaultValue),choose:task=>{$('regex-operation').value=task;operationChanged();},example:()=>{regexOrderTask(true);regexGuide.select('extract');}});
const regexAdvanced=document.createElement('details');regexAdvanced.innerHTML='<summary data-i18n="office.advanced"></summary>';
const flagField=$('regex-flags').closest('.field');flagField.before(regexAdvanced);regexAdvanced.append(flagField);
for(const element of [regexAdvanced,regexHeading]){const translate=()=>{for(const node of element.querySelectorAll('[data-i18n]'))node.textContent=t(node.dataset.i18n);};onLanguageChange(translate);translate();}

$('regex-operation').addEventListener('change',()=>regexGuide.select($('regex-operation').value));

actionArea($('regex-run').closest('.tool-actions'),$('regex-status'));
