import { t, translateDOM } from './i18n.js';
import { charsets } from './tools/convert/bytes.js';
import { md5Formats, compareMd5, exportMd5, md5Limits } from './tools/convert/md5.js';
import './md5-style.css';

// This view reuses the workbench editors and its cancellable Worker controller.
export function createMd5View({source,output,setDocument,setEditable,controller,notify}) {
  const $=id=>document.getElementById(id);
  const controls=document.createElement('section');controls.id='md5-controls';controls.className='md5-controls';
  controls.innerHTML=`<div class="md5-fields">
    <label><span data-i18n="common.type"></span><select id="md5-mode"></select></label>
    <label id="md5-representation-field"><span data-i18n="md5.representation"></span><select id="md5-representation"></select></label>
    <label id="md5-format-field" hidden><span data-i18n="md5.outputFormat"></span><select id="md5-format"></select></label>
    <label id="md5-skip-field" class="check-label" hidden><input id="md5-skip" type="checkbox"><span data-i18n="md5.skipEmpty"></span></label>
    <label id="md5-key-format-field" hidden><span data-i18n="md5.keyFormat"></span><select id="md5-key-format"></select></label>
    <label id="md5-key-field" hidden><span data-i18n="md5.key"></span><input id="md5-key" type="password" autocomplete="off" spellcheck="false" dir="ltr"></label>
  </div><p id="md5-mode-hint" class="md5-help"></p>
  <div id="md5-file-picker" hidden><button id="md5-choose" data-i18n="md5.chooseFiles"></button><input id="md5-files" type="file" multiple hidden><span id="md5-file-count"></span></div>`;
  $('tool-options').before(controls);
  const single=document.createElement('div');single.id='md5-single';single.className='md5-single';
  single.innerHTML=`<div id="md5-values"></div><div class="md5-verification"><label for="md5-expected" data-i18n="md5.expected"></label><div class="md5-expected-fields"><input id="md5-expected" type="text" dir="ltr" autocomplete="off" spellcheck="false"><select id="md5-expected-format" data-i18n-aria-label="md5.expectedFormat"></select></div><p id="md5-match" role="status"></p></div>`;
  $('convert-result').before(single);
  const table=document.createElement('div');table.id='md5-file-results';table.className='md5-table-wrap';table.hidden=true;
  table.innerHTML=`<table><thead><tr><th data-i18n="md5.filename"></th><th data-i18n="md5.size"></th><th data-i18n="common.result"></th><th data-i18n="md5.digest"></th><th data-i18n="md5.expected"></th></tr></thead><tbody id="md5-file-rows"></tbody></table></div>`;
  document.querySelector('.convert-editors').before(table);
  const actions=document.createElement('section');actions.id='md5-actions';
  actions.innerHTML=`<div class="toolbar"><button id="md5-run" class="primary" data-i18n="md5.run"></button><button id="md5-cancel" data-i18n="common.cancel" disabled></button><label id="md5-auto-field" class="check-label"><input id="md5-auto" type="checkbox" checked><span data-i18n="md5.auto"></span></label><span class="toolbar-spacer"></span><button id="md5-copy-item" data-i18n="md5.copyItem" hidden></button><button id="md5-copy-all" data-i18n="common.copyAll" disabled></button><button id="md5-csv" data-i18n="md5.downloadCsv" hidden disabled></button><button id="md5-json" data-i18n="md5.downloadJson" hidden disabled></button><button id="md5-clear" class="quiet" data-i18n="common.clear"></button></div>
  <progress id="md5-progress" max="1" value="0" hidden></progress><p id="md5-status" role="status" aria-live="polite"></p><p id="md5-truncated" class="md5-help" data-i18n="md5.truncatedNote"></p><p class="md5-security" data-i18n="md5.security"></p>`;
  document.querySelector('.convert-editors').before(actions);
  const formats=['hex32lower','hex32upper','hex16lower','hex16upper','base64'];
  const modes=['text','lines','files','hmac'];
  let active=false,mode='text',items=[],files=[],state={status:'idle'},progress,parkedText;
  const format=()=>$('md5-format').value || 'hex32lower';
  const error=item=>t(`md5.errors.${item.errorCode || 'unknown'}`,item.errorParams);
  const bytes=n=>n>=1024**3?`${(n/1024**3).toFixed(2)} GiB`:n>=1024**2?`${(n/1024**2).toFixed(1)} MiB`:n>=1024?`${(n/1024).toFixed(1)} KiB`:`${n} B`;
  const makeOption=(value,key)=>{const option=document.createElement('option');option.value=value;option.dataset.i18n=key;return option;};
  $('md5-mode').append(...modes.map(value=>makeOption(value,`md5.modes.${value}`)));
  for(const id of ['md5-representation','md5-key-format']) for(const value of (id==='md5-representation'?[...charsets,'hex','base64']:['utf-8','hex','base64'])) {const option=document.createElement('option');option.value=value;option.textContent=value;$(id).append(option);}
  $('md5-format').append(...formats.map(value=>makeOption(value,`md5.formats.${value}`)));
  $('md5-expected-format').append(...['hex32lower','base64','hex16lower'].map(value=>makeOption(value,`md5.formats.${value}`)));
  const valueFields=new Map();
  for(const value of formats) {
    const row=document.createElement('div');row.className=`md5-value${value==='hex32lower'?' md5-primary':''}`;
    const label=document.createElement('label');label.dataset.i18n=`md5.formats.${value}`;label.htmlFor=`md5-value-${value}`;
    const input=document.createElement('textarea');input.rows=2;input.id=label.htmlFor;input.readOnly=true;input.dir='ltr';input.spellcheck=false;
    const button=document.createElement('button');button.dataset.i18n='common.copy';button.disabled=true;button.addEventListener('click',()=>copy(input.value));
    row.append(label,input,button);$('md5-values').append(row);valueFields.set(value,{input,button});
  }
  const other=document.createElement('details');other.id='md5-other-formats';other.innerHTML='<summary data-i18n="md5.outputFormat"></summary>';
  $('md5-values').append(other);for(const row of [...$('md5-values').children])if(row!==other&&!row.classList.contains('md5-primary'))other.append(row);
  other.append($('md5-truncated'));
  const resultActions=document.createElement('div');resultActions.className='md5-result-actions toolbar';document.querySelector('.convert-editors').after(resultActions);resultActions.append($('md5-copy-all'),$('md5-copy-item'),$('md5-csv'),$('md5-json'));
  async function copy(value) {if(!value)return;try{await navigator.clipboard.writeText(value);notify(t('common.copied'));}catch{notify(t('common.copyFailed'));}}
  function comparison(hex,expected,representation,target) {
    const match=hex?compareMd5(hex,expected,representation):{status:'empty'};
    const key=match.status==='match'&&match.truncated?'truncated':match.status;
    target.textContent=t(`md5.compare.${key}`);target.dataset.match=match.status;
  }
  function verifySingle() {comparison(items[0]?.hex,$('md5-expected').value,$('md5-expected-format').value,$('md5-match'));}
  function statusText() {
    const status=$('md5-status');status.className=state.status==='error'?'md5-error':state.status==='cancelled'||state.status==='ready'&&items.some(item=>item.status!=='ready')?'md5-warning':'';
    status.textContent=state.status==='error'?error(state):state.status==='pending'?progress?t('md5.progress',{completed:progress.completed,total:progress.total,processed:bytes(progress.processedBytes),bytes:bytes(progress.totalBytes)}):t('common.processing'):state.status==='cancelled'?t('md5.cancelled'):state.status==='ready'?t('md5.finished',{completed:items.filter(item=>item.status==='ready').length,total:items.length}):t('md5.manual');
    $('md5-cancel').disabled=state.status!=='pending';
    $('md5-progress').hidden=state.status!=='pending'||mode!=='files';
    $('md5-progress').value=progress?.totalBytes?progress.processedBytes/progress.totalBytes:0;
  }
  function updateFile(row) {
    const tr=$(`md5-row-${row.id}`);if(!tr)return;
    tr.querySelector('[data-file-status]').textContent=row.status==='ready'?t('common.ready'):row.status==='error'?error(row):row.status==='cancelled'?t('md5.cancelled'):row.status==='pending'?t('common.processing'):t('md5.queued');
    tr.dataset.status=row.status;
    const digest=tr.querySelector('[data-file-digest]');digest.value=row.hex?md5Formats(row.hex)[format()]:'';
    tr.querySelector('button').disabled=row.status!=='ready'||!row.hex;
    const meter=tr.querySelector('progress');meter.value=row.status==='ready'?1:row.progress || 0;
    comparison(row.hex,row.expected || '',row.expectedFormat || 'hex32lower',tr.querySelector('[data-file-match]'));
  }
  function fileTable() {
    $('md5-file-rows').replaceChildren(...files.map(row=>{
      const tr=document.createElement('tr');tr.id=`md5-row-${row.id}`;
      const name=document.createElement('td');name.textContent=row.name;name.dir='ltr';
      const size=document.createElement('td');size.textContent=String(row.size);size.dir='ltr';
      const status=document.createElement('td');status.innerHTML='<span data-file-status></span><progress max="1" value="0"></progress>';
      const digest=document.createElement('td');const value=document.createElement('textarea');value.rows=2;value.readOnly=true;value.dir='ltr';value.dataset.fileDigest='';value.setAttribute('aria-label',t('md5.digest'));
      const button=document.createElement('button');button.dataset.i18n='common.copy';button.setAttribute('aria-label',t('direct.developer.md5CopyFile',{name:row.name}));button.addEventListener('click',()=>copy(value.value));digest.append(value,button);
      const expected=document.createElement('td');const input=document.createElement('input');input.dir='ltr';input.autocomplete='off';input.spellcheck=false;input.value=row.expected || '';input.setAttribute('aria-label',t('md5.expected'));
      const select=document.createElement('select');select.append(...['hex32lower','base64','hex16lower'].map(format=>makeOption(format,`md5.formats.${format}`)));select.value=row.expectedFormat || 'hex32lower';select.dataset.i18nAriaLabel='md5.expectedFormat';select.setAttribute('aria-label',t('md5.expectedFormat'));
      const match=document.createElement('span');match.dataset.fileMatch='';
      input.addEventListener('input',()=>{row.expected=input.value;comparison(row.hex,row.expected,select.value,match);});
      select.addEventListener('change',()=>{row.expectedFormat=select.value;comparison(row.hex,input.value,select.value,match);});
      expected.append(input,select,match);tr.append(name,size,status,digest,expected);return tr;
    }));
    translateDOM(table);files.forEach(updateFile);
  }
  function renderResults(updateDocument=true) {
    const singleItem=items[0];const values=singleItem?.hex?md5Formats(singleItem.hex):{};
    for(const [key,{input,button}] of valueFields) {if(state.status!=='pending'||singleItem)input.value=values[key] || '';button.disabled=state.status==='pending'||!values[key];button.hidden=!values[key];button.setAttribute('aria-label',`${t('common.copy')} · ${t(`md5.formats.${key}`)}`);}
    other.hidden=!singleItem?.hex;
    if(state.status!=='pending'||singleItem)verifySingle();
    const ready=state.status!=='pending'&&items.some(item=>item.status==='ready');
    for(const id of ['md5-copy-all','md5-csv','md5-json']){$(id).disabled=!ready;$(id).hidden=!ready||id!=='md5-copy-all'&&!['files','lines'].includes(mode);}
    $('md5-copy-item').disabled=!ready;
    if(mode==='files') files.forEach(updateFile);
    if(mode==='lines'&&updateDocument) setDocument(output,items.map(item=>`${item.line}\t${item.hex?md5Formats(item.hex)[format()]:item.status==='cancelled'?t('md5.cancelled'):error(item)}`).join('\n'));
    if(['text','hmac'].includes(mode)&&singleItem?.status==='error') {state=singleItem;statusText();}
  }
  function reset() {
    items=[];progress=undefined;files.forEach(row=>{delete row.hex;delete row.errorCode;row.status='queued';row.progress=0;});
    renderResults();if(mode!=='lines') setDocument(output,'');
  }
  function clearKey() {$('md5-key').value='';}
  function execute(auto=false) {
    if(!active)return;
    if(mode==='files'&&!files.length){controller.invalidate();notify(t('md5.emptyFileQueue'));return;}
    const input=mode==='files'?files.map(row=>row.file):source.state.doc.toString();
    if(auto&&(mode!=='text'||!$('md5-auto').checked)) {controller.invalidate();return;}
    controller.process({toolId:'md5',input,options:{mode,representation:$('md5-representation').value,skipEmpty:$('md5-skip').checked,key:mode==='hmac'?$('md5-key').value:'',keyFormat:$('md5-key-format').value}},{auto,wait:350});
  }
  function changed() {if(active)execute(true);}
  function layout() {
    document.body.dataset.md5Mode=mode;
    $('md5-representation-field').hidden=mode==='files';$('md5-format-field').hidden=!['lines','files'].includes(mode);
    $('md5-skip-field').hidden=mode!=='lines';$('md5-key-field').hidden=mode!=='hmac';$('md5-key-format-field').hidden=mode!=='hmac';
    $('md5-file-picker').hidden=mode!=='files';table.hidden=mode!=='files';single.hidden=!['text','hmac'].includes(mode);
    const ready=state.status!=='pending'&&items.some(item=>item.status==='ready');
    $('md5-auto-field').hidden=mode!=='text';$('md5-copy-item').hidden=mode!=='lines'||!ready;$('md5-csv').hidden=!['lines','files'].includes(mode)||!ready;$('md5-json').hidden=$('md5-csv').hidden;
    $('md5-mode-hint').textContent=mode==='lines'?t('md5.linesHint'):mode==='files'?t('md5.fileHint'):mode==='hmac'?t('md5.clearKeyHint'):'';
    $('md5-choose').textContent=t(files.length?'direct.developer.fileReplace':'md5.chooseFiles');
    $('md5-file-count').textContent=files.length?`${files.length} / ${md5Limits.files}`:'';
  }
  function onState(next) {
    if(!active)return;
    if(next.status==='idle'&&state.status==='pending'&&mode==='hmac')clearKey();
    state=next;
    if(next.status==='pending'){items=[];progress=undefined;files.forEach(row=>{row.status='queued';row.progress=0;});}
    if(next.status==='idle')reset();
    if(next.status==='ready')items=next.items;
    if(next.status==='cancelled') {
      if(mode==='files')files.forEach(row=>{if(['queued','pending'].includes(row.status))row.status='cancelled';});
      if(mode==='lines') {
        const lines=source.state.doc.toString().split(/\r\n|\r|\n/);if(/[\r\n]$/.test(source.state.doc.toString()))lines.pop();
        const done=new Set(items.map(item=>item.line));lines.forEach((line,index)=>{if(!done.has(index+1)&&(!$('md5-skip').checked||line.length))items.push({id:String(index),line:index+1,status:'cancelled',size:0});});
      }
    }
    if(['ready','error','cancelled'].includes(next.status)){if(mode==='files')files.forEach(row=>{if(next.status==='error'&&['queued','pending'].includes(row.status)){row.status='error';row.errorCode=next.errorCode||'unknown';}if(row.status!=='ready')delete row.hex;});clearKey();}
    renderResults(next.status!=='pending');statusText();
  }
  function onEvent(event) {
    if(!active||state.status!=='pending')return;
    if(event.event==='item-complete') {
      const item={...event.item};items.push(item);
      if(mode==='files'){const row=files.find(row=>row.id===item.id);Object.assign(row,item);if(item.status!=='ready')delete row.hex;}
      if(mode!=='lines')renderResults(false);
    } else if(event.event==='progress') {
      progress=event;const row=files.find(row=>row.id===event.itemId);if(row){if(row.status==='queued')row.status='pending';row.progress=event.fileBytes?event.bytesRead/event.fileBytes:1;updateFile(row);}statusText();
    }
  }
  function importFiles(selected) {
    if(!selected.length)return;
    if(selected.length>md5Limits.files){notify(t('md5.errors.fileCount'));return;}
    controller.invalidate();clearKey();
    files=selected.map((file,index)=>({id:String(index),file,name:file.name,size:file.size,status:'queued',expected:'',expectedFormat:'hex32lower'}));
    fileTable();layout();
  }
  function translate() {
    translateDOM(controls);translateDOM(single);translateDOM(actions);translateDOM(resultActions);translateDOM(table);
    for(const row of files){const tr=$(`md5-row-${row.id}`);if(!tr)continue;tr.querySelector('button').setAttribute('aria-label',t('direct.developer.md5CopyFile',{name:row.name}));for(const input of tr.querySelectorAll('input,[data-file-digest]'))input.setAttribute('aria-label',`${t(input.readOnly?'md5.digest':'md5.expected')} · ${row.name}`);}
    layout();renderResults(false);statusText();
    $('tool-title').textContent=t('md5.title');$('tool-hint').textContent=t('md5.description');
    document.querySelector('.page-heading h1').textContent=t('md5.title');document.querySelector('.page-heading p').textContent=t('md5.description');document.title=`${t('md5.title')} · LisTools`;
    for(const element of document.querySelectorAll('[data-convert]')) {const key={input:'common.input',output:'common.result',searchText:'common.search',limits:'md5.limits',drop:'md5.drop',dropHint:'md5.fileHint'}[element.dataset.convert];if(key)element.textContent=t(key);}
    $('md5-truncated').hidden=false;
  }
  $('md5-mode').addEventListener('change',()=>{
    const next=$('md5-mode').value;if(next===mode)return;
    if((files.length||items.length||$('md5-expected').value||$('md5-key').value)&&!confirm(t('direct.developer.md5ModeConfirm'))){$('md5-mode').value=mode;$('md5-mode').focus();return;}
    controller.invalidate();clearKey();mode=next;$('md5-expected').value='';files=[];items=[];fileTable();reset();layout();statusText();
  });
  for(const id of ['md5-representation','md5-skip','md5-key','md5-key-format','md5-auto']) $(id).addEventListener(id==='md5-key'?'input':'change',changed);
  $('md5-format').addEventListener('change',()=>renderResults());
  for(const id of ['md5-expected','md5-expected-format'])$(id).addEventListener(id==='md5-expected'?'input':'change',verifySingle);
  $('md5-run').addEventListener('click',()=>execute());$('md5-cancel').addEventListener('click',()=>controller.cancel());
  $('md5-choose').addEventListener('click',()=>$('md5-files').click());$('md5-files').addEventListener('change',()=>{if($('md5-files').files.length)importFiles(Array.from($('md5-files').files));$('md5-files').value='';});
  $('md5-clear').addEventListener('click',()=>{controller.invalidate();clearKey();$('md5-expected').value='';files=[];fileTable();reset();setDocument(source,'');layout();source.focus();});
  $('md5-copy-item').addEventListener('click',()=>{const index=output.state.doc.lineAt(output.state.selection.main.head).number-1;const item=items[index];if(item?.hex)copy(md5Formats(item.hex)[format()]);});
  $('md5-copy-all').addEventListener('click',()=>{
    if(state.status==='pending')return;
    if(['text','hmac'].includes(mode)){const hex=items[0]?.hex;if(hex)copy(formats.map(key=>`${t(`md5.formats.${key}`)}: ${md5Formats(hex)[key]}`).join('\n'));}
    else copy(items.filter(item=>item.hex).map(item=>`${mode==='files'?item.name:item.line}\t${md5Formats(item.hex)[format()]}`).join('\n'));
  });
  for(const type of ['csv','json'])$(`md5-${type}`).addEventListener('click',()=>{
    const labels=Object.fromEntries(['line','name','size','status','digest'].map(key=>[key,t(key==='name'?'md5.filename':key==='status'?'common.result':`md5.${key}`)]));
    if(state.status==='pending'||!items.some(item=>item.status==='ready'))return;
    const data=exportMd5(mode==='files'?files.map(row=>items.find(item=>item.id===row.id)||{id:row.id,name:row.name,size:row.size,status:row.status}):items,format(),type,labels);const url=URL.createObjectURL(new Blob([data],{type:type==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`listools-md5.${type}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {hasContent:()=>Boolean(files.length||active&&(items.length||$('md5-key').value||$('md5-expected').value)),getInputFiles:()=>files.map(row=>row.file),get mode(){return mode;},onState,onEvent,execute,changed,importFiles,translate,
    activate({inputFile}={}){active=true;setEditable(true);document.body.classList.add('md5-page');controls.hidden=false;actions.hidden=false;resultActions.hidden=false;single.hidden=false;if(inputFile&&!(files.length===1&&files[0].file===inputFile)){mode='files';$('md5-mode').value=mode;importFiles([inputFile instanceof File?inputFile:new File([inputFile],'listools-bytes')]);}if(mode!=='files'&&parkedText!==undefined&&parkedText!==source.state.doc.toString())onState({status:'idle'});translate();renderResults();},
    deactivate(){if(active){parkedText=source.state.doc.toString();if(state.status==='pending')controller.cancel();}active=false;clearKey();document.body.classList.remove('md5-page');controls.hidden=true;actions.hidden=true;resultActions.hidden=true;single.hidden=true;table.hidden=true;},
    clearKey};
}
