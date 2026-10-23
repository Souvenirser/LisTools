import {version,bugs} from '../../../package.json';
import {pages,toolGroups,searchNavigation,currentTarget} from './navigation.js';
import {mountFeedbackLink} from './feedback.js';
import {t,language,onLanguageChange} from '../../i18n-runtime.js';
import './menu.css';
import {hasUserContent} from './content-state.js';
import {menuOrderKey,normalizeMenuOrder,readMenuOrder,saveMenuOrder} from './menu-order.js';

const label=item=>item.key?t(item.key):(item.name || [item.zh,item.en])[language().startsWith('zh')?0:1];
const iconText=(icon,text)=>{
  const mark=document.createElement('span');mark.className='tool-menu-icon';mark.textContent=icon;mark.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.className='tool-menu-name';name.textContent=text;
  return [mark,name];
};

export function mountToolMenu(root,{popup=false,close=()=>{}}={}) {
  root.classList.add('tool-menu');
  root.innerHTML=`<div class="tool-menu-search"><label class="sr-only" for="tool-menu-search"></label><input id="tool-menu-search" type="search" autocomplete="off" spellcheck="false" autofocus></div><nav class="tool-menu-list"></nav><p class="tool-menu-empty" role="status" hidden></p><footer class="tool-menu-footer"><span>LisTools <span id="app-version">v${version}</span></span><span class="tool-menu-hint"></span></footer>`;
  const search=root.querySelector('input'),list=root.querySelector('nav'),empty=root.querySelector('.tool-menu-empty');
  const controls=document.createElement('div');controls.className='tool-menu-order-controls';controls.innerHTML='<button id="menu-edit" type="button"></button><div class="tool-menu-order-actions" hidden><button id="menu-save" type="button" class="primary"></button><button id="menu-cancel" type="button"></button><button id="menu-reset" type="button"></button></div><div class="tool-menu-move-actions" hidden><button id="menu-up" type="button">↑</button><button id="menu-down" type="button">↓</button></div><p id="menu-sort-status" role="status" aria-live="polite"></p>';list.before(controls);
  const button=id=>root.querySelector('#menu-'+id),status=button('sort-status');
  let draft,selected,sortables=[],savedSearch='',loadingSort=false,normalOpen,editOpen=new Set(),revision=0;
  const editing=()=>Boolean(draft);
  function stopSorting(){for(const sortable of sortables)sortable.destroy();sortables=[];}
  function handle(name){const node=document.createElement('button');node.type='button';node.className='tool-menu-sort-handle';node.textContent='⠿';node.setAttribute('aria-label',t('workspace.sortHandle',{name}));return node;}
  function announce(key,params){status.dataset.key=key;status.dataset.params=JSON.stringify(params||{});status.textContent=t(key,params);}
  function selectRow(row){root.querySelector('.is-sort-selected')?.classList.remove('is-sort-selected');selected=row;row?.classList.add('is-sort-selected');button('up').disabled=!row?.previousElementSibling;button('down').disabled=!row?.nextElementSibling;}
  function capture(){draft=normalizeMenuOrder({version:1,groups:[...list.children].map(node=>node.dataset.groupId),items:Object.fromEntries([...list.children].map(node=>[node.dataset.groupId,[...node.querySelector('.tool-menu-group').children].map(child=>child.dataset.toolId)]))});}
  function moved(row){selectRow(row);capture();announce('workspace.moved',{name:row.querySelector('.tool-menu-name').textContent,position:[...row.parentElement.children].indexOf(row)+1});}
  function move(delta){if(!selected)return;const sibling=delta<0?selected.previousElementSibling:selected.nextElementSibling;if(!sibling)return;selected.parentElement.insertBefore(selected,delta<0?sibling:sibling.nextElementSibling);moved(selected);selected.querySelector('.tool-menu-sort-handle').focus();selected.scrollIntoView({block:'nearest'});}
  async function activateSorting(currentRevision){
    const {default:Sortable}=await import('sortablejs');if(!draft||currentRevision!==revision)return;
    const options={animation:matchMedia('(prefers-reduced-motion:reduce)').matches?0:150,handle:'.tool-menu-sort-handle',delay:200,delayOnTouchOnly:true,touchStartThreshold:5,ghostClass:'tool-menu-sort-ghost',onEnd:event=>moved(event.item),group:{pull:false,put:false}};
    sortables.push(new Sortable(list,{...options,draggable:'details',handle:'summary > .tool-menu-sort-handle'}));
    for(const body of list.querySelectorAll('.tool-menu-group'))sortables.push(new Sortable(body,{...options,draggable:'.tool-menu-sort-row'}));
  }
  function finish(save){if(!draft)return;const saved=save&&saveMenuOrder(draft);draft=undefined;selected=undefined;search.disabled=false;search.value=savedSearch;render();announce(save?saved?'workspace.saved':'workspace.notSaved':'workspace.sortHint');button('edit').focus();}
  button('edit').onclick=async()=>{if(loadingSort)return;loadingSort=true;savedSearch=search.value;search.value='';search.disabled=true;editOpen.clear();normalOpen=new Map([...list.querySelectorAll(':scope>details')].map(node=>[node.dataset.groupId,node.open]));draft=readMenuOrder();announce('workspace.sortHint');render();loadingSort=false;};
  button('save').onclick=()=>finish(true);button('cancel').onclick=()=>finish(false);button('reset').onclick=()=>{draft=normalizeMenuOrder();render();announce('workspace.sortHint');};button('up').onclick=()=>move(-1);button('down').onclick=()=>move(1);
  const refreshFeedback=popup?mountFeedbackLink(root.querySelector('.tool-menu-footer'),()=>({
    issuesUrl:bugs.url,tool:'toolbox',version,locale:language(),label:t('common.feedback'),hint:t('common.feedbackHint')
  })):()=>{};
  let composing=false;
  function refreshCurrent(){
    if(popup)return;
    const links=[...list.querySelectorAll('a[data-target]')];
    for(const link of links)link.removeAttribute('aria-current');
    const current=links.find(link=>link.dataset.target===currentTarget(location.pathname,location.hash))||links.find(link=>link.dataset.target===location.pathname.split('/').pop());
    current?.setAttribute('aria-current','page');
  }
  function link(item,searchResult=false) {
    const element=document.createElement('a');element.href=`./${item.file}`;element.dataset.target=item.file;
    element.className='tool-menu-link';element.append(...iconText(item.icon || '⇄',label(item)));
    element.dataset.toolId=item.id;
    if(popup||(!popup&&new URL(element.href).pathname!==location.pathname&&hasUserContent())){element.target='_blank';element.rel='noopener';}
    if(searchResult && item.summaryKey){
      const context=document.createElement('small');context.textContent=(item.parentKey?t(item.parentKey)+' · ':'')+t(item.summaryKey);element.querySelector('.tool-menu-name').append(context);
    }
    return element;
  }
  function group(text,icon,children) {
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.append(...iconText(icon,text));
    const arrow=document.createElement('span');arrow.className='tool-menu-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');summary.append(arrow);
    const body=document.createElement('div');body.className='tool-menu-group';body.append(...children);
    details.append(summary,body);return details;
  }
  function render() {
    revision++;stopSorting();selected=undefined;root.classList.toggle('is-sorting',editing());button('edit').hidden=editing();root.querySelector('.tool-menu-order-actions').hidden=!editing();root.querySelector('.tool-menu-move-actions').hidden=!editing();button('up').disabled=button('down').disabled=true;
    const query=search.value.trim();
    if(query){const matches=searchNavigation(query,t),primary=matches.filter(item=>!item.secondary),secondary=matches.filter(item=>item.secondary);list.replaceChildren(...primary.map(item=>link(item,true)));if(secondary.length){const heading=document.createElement('p');heading.className='tool-menu-secondary';heading.textContent=t('ux.otherMatches');list.append(heading,...secondary.map(item=>link(item,true)));}}
    else {
      const order=draft||readMenuOrder();
      const groups=order.groups.map((id,index)=>{
        const {key,icon}=toolGroups.find(item=>item.id===id),items=order.items[id].map(id=>pages.find(page=>page.id===id));
        const node=group(t(key),icon,items.map(page=>{if(!draft)return link(page);const row=document.createElement('div');row.className='tool-menu-sort-row';row.dataset.toolId=page.id;row.append(handle(label(page)),...iconText(page.icon,label(page)));return row;}));node.dataset.groupId=id;
        if(draft)node.querySelector('summary').prepend(handle(t(key)));
        node.open=popup?index<2:items.some(item=>item.file===currentTarget(location.pathname,location.hash)||item.file===location.pathname.split('/').pop());
        if(draft)node.open=editOpen.has(id);else if(normalOpen?.has(id))node.open=normalOpen.get(id);
        return node;
      });
      list.replaceChildren(...groups);
      if(draft)void activateSorting(revision);else normalOpen=undefined;
    }
    refreshCurrent();
    empty.hidden=list.children.length!==0;empty.textContent=t('menu.noResults');
    list.setAttribute('aria-label',t('common.navigation'));
  }
  function translate() {
    refreshFeedback();
    search.placeholder=t('menu.search');search.setAttribute('aria-label',t('menu.search'));
    root.querySelector('label').textContent=t('menu.search');root.querySelector('.tool-menu-hint').textContent=t(popup?'menu.newTab':'menu.keyboard');render();
    for(const [id,key]of Object.entries({edit:'sort',save:'done',cancel:'cancel',reset:'reset',up:'up',down:'down'})){button(id).textContent=t('workspace.'+key);}
    if(status.dataset.key)status.textContent=t(status.dataset.key,JSON.parse(status.dataset.params));
  }
  root.addEventListener('click',event=>{
    if(editing()){const row=event.target.closest('.tool-menu-sort-row,summary');if(row){if(event.target.closest('.tool-menu-sort-handle'))event.preventDefault();selectRow(row.matches('summary')?row.parentElement:row);}if(event.target.closest('a'))event.preventDefault();return;}
    const anchor=event.target.closest('a[data-target]');
    if(!anchor || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    if(!popup){
      if(anchor.dataset.target===currentTarget(location.pathname,location.hash))event.preventDefault();
      else if(new URL(anchor.href).pathname!==location.pathname&&hasUserContent()){anchor.target='_blank';anchor.rel='noopener';}
    }
    if(popup){
      // Native anchors preserve modifier/middle-click behavior; normal launch closes the action popup.
      const tabs=globalThis.browser?.tabs || globalThis.chrome?.tabs;
      if(tabs){event.preventDefault();void tabs.create({url:anchor.href}).then(()=>window.close());}
    }else close();
  });
  root.addEventListener('keydown',event=>{
    if(composing || event.isComposing || event.keyCode===229)return;
    if(editing()&&event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const handle=event.target.closest('.tool-menu-sort-handle');if(handle)selectRow(handle.closest('.tool-menu-sort-row')||handle.closest('details'));move(event.key==='ArrowUp'?-1:1);return;}
    if(event.key==='Escape'){
      event.preventDefault();
      if(editing()){finish(false);return;}
      if(popup)window.close();else close();
      return;
    }
    const rows=[...list.querySelectorAll(editing()?'.tool-menu-sort-handle':'a,summary')].filter(element=>element.checkVisibility());
    const index=rows.indexOf(document.activeElement);
    if(event.key==='ArrowDown' || event.key==='ArrowUp') {
      event.preventDefault();
      const next=index<0?(event.key==='ArrowDown'?0:rows.length-1):(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;
      rows[next]?.focus();rows[next]?.scrollIntoView({block:'nearest'});
    }else if(event.key==='Enter' && event.target===search && rows.length){event.preventDefault();rows[0].click();}
  });
  search.addEventListener('compositionstart',()=>{composing=true;});
  search.addEventListener('compositionend',()=>{composing=false;render();});
  search.addEventListener('input',()=>{if(!composing)render();});
  list.addEventListener('toggle',event=>{if(editing()&&event.target.matches('details[data-group-id]')){if(event.target.open)editOpen.add(event.target.dataset.groupId);else editOpen.delete(event.target.dataset.groupId);}},true);
  list.addEventListener('focusin',event=>{if(editing()&&event.target.matches('.tool-menu-sort-handle'))selectRow(event.target.closest('.tool-menu-sort-row')||event.target.closest('details'));});
  addEventListener('storage',event=>{if(event.key===menuOrderKey&&!editing())render();});
  addEventListener('hashchange',refreshCurrent);
  onLanguageChange(translate);translate();
  return {open(){render();search.focus();},reset(){if(editing())finish(false);composing=false;search.value='';render();}};
}

export function mountHeaderMenu() {
  const trigger=document.querySelector('button.brand');
  if(!trigger)return;
  const popover=document.createElement('div');popover.id='tool-menu';popover.setAttribute('popover','auto');
  document.body.append(popover);trigger.setAttribute('popovertarget',popover.id);trigger.setAttribute('aria-controls',popover.id);trigger.setAttribute('aria-expanded','false');
  const menu=mountToolMenu(popover,{close:()=>{popover.hidePopover();trigger.focus();}});
  function position() {
    const rect=trigger.getBoundingClientRect();
    const left=document.documentElement.dir==='rtl'?rect.right-popover.offsetWidth:rect.left;
    popover.style.left=`${Math.max(8,Math.min(left,innerWidth-popover.offsetWidth-8))}px`;
    popover.style.top=`${rect.bottom+8}px`;
  }
  popover.addEventListener('beforetoggle',event=>{if(event.newState==='closed')menu.reset();});
  popover.addEventListener('toggle',event=>{
    const open=event.newState==='open';trigger.setAttribute('aria-expanded',String(open));
    if(open){position();menu.open();}
  });
  window.addEventListener('resize',()=>{if(popover.matches(':popover-open'))position();});
}
