import {mountWorkbenchShell} from './shell.js';
import {preferencesKey,readPreferences,toggleFavorite,recordRecent} from './preferences.js';
import {createMenuIcon} from './icons.js';
import {version,bugs} from '../../../package.json';
import {pages,toolGroups,searchNavigation,currentTarget,resolveTaskRoute} from './navigation.js';
import {mountFeedbackLink} from './feedback.js';
import {t,language,onLanguageChange} from '../../i18n-runtime.js';
import './menu.css';
import {hasUserContent} from './content-state.js';
import {menuOrderKey,normalizeMenuOrder,readMenuOrder,saveMenuOrder,menuExpandedKey,readMenuExpanded,saveMenuExpanded} from './menu-order.js';

const label=item=>item.key?t(item.key):(item.name || [item.zh,item.en])[language().startsWith('zh')?0:1];
const iconText=(icon,text)=>{
  const mark=document.createElement('span');mark.className='tool-menu-icon';mark.append(createMenuIcon(icon));mark.setAttribute('aria-hidden','true');
  const name=document.createElement('span');name.className='tool-menu-name';name.textContent=text;
  return [mark,name];
};

export function mountToolMenu(root,{popup=false,close=()=>{}}={}) {
  root.classList.add('tool-menu');
  root.innerHTML=`<div class="tool-menu-search"><label class="sr-only" for="tool-menu-search"></label><input id="tool-menu-search" type="search" autocomplete="off" spellcheck="false"${popup?' autofocus':''}></div><nav class="tool-menu-list"></nav><p class="tool-menu-empty" role="status" hidden></p><footer class="tool-menu-footer"><span>LisTools <span id="app-version">v${version}</span></span><span class="tool-menu-hint"></span></footer>`;
  const search=root.querySelector('input'),list=root.querySelector('nav'),empty=root.querySelector('.tool-menu-empty');
  const scroll=document.createElement('div');scroll.className='tool-menu-scroll';list.before(scroll);const saved=document.createElement('div');saved.className='tool-menu-saved';scroll.append(saved,list);
  const controls=document.createElement('div');controls.className='tool-menu-order-controls';controls.innerHTML='<button id="menu-edit" type="button"></button><div class="tool-menu-order-actions" hidden><button id="menu-save" type="button" class="primary"></button><button id="menu-cancel" type="button"></button><button id="menu-reset" type="button"></button></div><div class="tool-menu-move-actions" hidden><button id="menu-up" type="button">↑</button><button id="menu-down" type="button">↓</button></div><p id="menu-sort-status" role="status" aria-live="polite"></p>';scroll.before(controls);
  const button=id=>root.querySelector('#menu-'+id),status=button('sort-status');
  let renderedFavorites='';
  let draft,selected,sortables=[],savedSearch='',loadingSort=false,expanded=new Set(readMenuExpanded()),editOpen=new Set(),revision=0;
  const editing=()=>Boolean(draft);
  const viewKey='listools-menu-view-v1';let savedView,renderedQuery='';
  try{savedView=JSON.parse(localStorage.getItem(viewKey));}catch{}
  function view(){
    const top=scroll.getBoundingClientRect().top,node=[...scroll.querySelectorAll('.tool-menu-item,nav>details>summary')].find(node=>node.checkVisibility()&&node.getBoundingClientRect().bottom>top+1);
    return {top:scroll.scrollTop,tool:node?.dataset.menuToolId,group:node?.closest('details[data-group-id]')?.dataset.groupId,saved:node?.closest('[data-saved-group]')?.dataset.savedGroup,offset:node?node.getBoundingClientRect().top-top:0};
  }
  function restoreView(value){
    if(!value||!Number.isFinite(value.top)||!Number.isFinite(value.offset))return;
    const parent=value.group?[...list.children].find(node=>node.dataset.groupId===value.group):[...saved.children].find(node=>node.dataset.savedGroup===value.saved);
    const node=value.tool?[...(parent?.querySelectorAll('[data-menu-tool-id]')||[])].find(node=>node.dataset.menuToolId===value.tool):parent?.querySelector('summary');
    if(node?.checkVisibility())scroll.scrollTop+=node.getBoundingClientRect().top-scroll.getBoundingClientRect().top-value.offset;else scroll.scrollTop=value.top;
  }
  function rememberView(){if(!popup&&root.classList.contains('is-sidebar')&&!search.value&&!editing()){try{localStorage.setItem(viewKey,JSON.stringify(view()));}catch{}}}
  addEventListener('pagehide',rememberView);
  function setExpanded(node,open){
    const groups=editing()?editOpen:expanded,id=node.dataset.groupId;if(groups.has(id)===open)return;
    if(open)groups.add(id);else groups.delete(id);
    if(!editing())saveMenuExpanded([...expanded]);
  }
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
  function finish(save,closeMenu=true){if(!draft)return;const saved=save&&saveMenuOrder(draft);draft=undefined;selected=undefined;search.disabled=false;search.value=savedSearch;render();announce(save?saved?'workspace.saved':'workspace.notSaved':'workspace.sortHint');if(closeMenu){close();(button('edit').checkVisibility()?button('edit'):document.getElementById('settings-open'))?.focus({preventScroll:true});}}
  button('edit').onclick=async()=>{if(loadingSort)return;loadingSort=true;savedSearch=search.value;search.value='';search.disabled=true;editOpen.clear();draft=readMenuOrder();announce('workspace.sortHint');render();loadingSort=false;};
  button('save').onclick=()=>finish(true);button('cancel').onclick=()=>finish(false);button('reset').onclick=()=>{draft=normalizeMenuOrder();render();announce('workspace.sortHint');};button('up').onclick=()=>move(-1);button('down').onclick=()=>move(1);
  const refreshFeedback=popup?mountFeedbackLink(root.querySelector('.tool-menu-footer'),()=>({
    issuesUrl:bugs.url,tool:'toolbox',version,locale:language(),label:t('common.feedback'),hint:t('common.feedbackHint')
  })):()=>{};
  const recentButton=document.createElement('button');recentButton.id='recent-open';recentButton.type='button';recentButton.className='header-recent';const recentCaption=document.createElement('span');recentCaption.className='recent-caption';recentButton.append(createMenuIcon('clock-3'),recentCaption);recentButton.setAttribute('popovertarget','recent-tools');recentButton.setAttribute('aria-controls','recent-tools');recentButton.setAttribute('aria-expanded','false');
  const recent=document.createElement('div');recent.id='recent-tools';recent.className='recent-tools';recent.setAttribute('popover','auto');const recentList=document.createElement('nav');recentList.setAttribute('aria-labelledby',recentButton.id);recent.append(recentList);document.body.append(recent);document.querySelector(popup?'.popup-header':'.app-header')?.append(recentButton);
  function renderRecent(){
    const active=recent.contains(document.activeElement)?document.activeElement.dataset.target:undefined,items=readPreferences().recent.map(id=>pages.find(item=>item.id===id)).filter(Boolean);recentList.replaceChildren(...items.map(item=>link(item)));
    if(!items.length){const hint=document.createElement('p');hint.textContent=t('v2.noRecent');recentList.append(hint);}
    if(active)([...recentList.querySelectorAll('a')].find(node=>node.dataset.target===active)||recentList.querySelector('a')||recentButton).focus({preventScroll:true});
  }
  function positionRecent(){const rect=recentButton.getBoundingClientRect(),width=Math.min(360,innerWidth-24);recent.style.left=`${Math.max(12,Math.min(document.documentElement.dir==='rtl'?rect.left:rect.right-width,innerWidth-width-12))}px`;recent.style.top=`${rect.bottom+8}px`;recent.style.maxHeight=`${Math.max(0,innerHeight-rect.bottom-20)}px`;}
  recent.addEventListener('beforetoggle',event=>{if(event.newState==='open'){renderRecent();positionRecent();}else if(recent.contains(document.activeElement))recentButton.focus({preventScroll:true});});
  recent.addEventListener('toggle',event=>{recentButton.setAttribute('aria-expanded',String(event.newState==='open'));if(event.newState==='open')positionRecent();});
  recentButton.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();if(!recent.matches(':popover-open'))recent.showPopover();recentList.querySelector('a')?.focus();}});
  recent.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();recent.hidePopover();recentButton.focus({preventScroll:true});return;}if(!['ArrowDown','ArrowUp'].includes(event.key))return;event.preventDefault();const links=[...recentList.querySelectorAll('a')],index=links.indexOf(document.activeElement);links[index<0?0:(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length]?.focus();});
  recent.addEventListener('click',navigate);addEventListener('resize',()=>{if(recent.matches(':popover-open'))positionRecent();});
  let composing=false;
  function refreshCurrent(){
    if(popup)return;
    const links=[...list.querySelectorAll('a[data-target]')];
    for(const link of links)link.removeAttribute('aria-current');
    const current=links.find(link=>link.dataset.target===location.pathname.split('/').pop()+location.hash)||links.find(link=>link.dataset.target===currentTarget(location.pathname,location.hash))||links.find(link=>link.dataset.target===location.pathname.split('/').pop());
    current?.setAttribute('aria-current','page');
  }
  function link(item,searchResult=false) {
    const element=document.createElement('a');element.href=`./${item.file}`;element.dataset.target=item.file;
    element.className='tool-menu-link';element.append(...iconText(item.icon || '⇄',label(item)));
    element.dataset.toolId=item.id;element.title=label(item);
    if(popup||(!popup&&new URL(element.href).pathname!==location.pathname&&hasUserContent())){element.target='_blank';element.rel='noopener';}
    if(searchResult && item.summaryKey){
      const context=document.createElement('small');context.textContent=(item.parentKey?t(item.parentKey)+' · ':'')+t(item.summaryKey);element.querySelector('.tool-menu-name').append(context);
    }
    return element;
  }
  function itemRow(item){
    const row=document.createElement('div');row.className='tool-menu-item';row.dataset.menuToolId=item.id;const pin=document.createElement('button');pin.type='button';pin.className='tool-menu-favorite';pin.dataset.favorite=item.id;const selected=readPreferences().favorites.includes(item.id);pin.setAttribute('aria-pressed',String(selected));pin.setAttribute('aria-label',t(selected?'v2.unpin':'v2.pin')+' · '+label(item));pin.title=pin.getAttribute('aria-label');pin.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="'+(selected?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.7"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';row.append(link(item),pin);return row;
  }
  function renderSaved(query){
    saved.replaceChildren();saved.hidden=Boolean(query)||editing();if(saved.hidden)return;
    const value=readPreferences();for(const [key,ids]of [['favorites',value.favorites]]){if(!ids.length)continue;const section=document.createElement('section'),heading=document.createElement('h3');section.dataset.savedGroup=key;heading.textContent=t('v2.'+key);section.append(heading);if(ids.length){for(const id of ids){const item=pages.find(page=>page.id===id);if(item)section.append(itemRow(item));}}else if(key==='favorites'){const hint=document.createElement('p');hint.textContent=t('v2.noFavorites');section.append(hint);}else continue;saved.append(section);}saved.hidden=!saved.children.length;
  }
  function group(text,children) {
    const details=document.createElement('details'),summary=document.createElement('summary');
    const name=document.createElement('span');name.className='tool-menu-name';name.textContent=text;summary.append(name);summary.title=text;summary.setAttribute('aria-label',text);
    const arrow=document.createElement('span');arrow.className='tool-menu-arrow';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');summary.append(arrow);
    const body=document.createElement('div');body.className='tool-menu-group';body.append(...children);
    details.append(summary,body);return details;
  }
  function render() {
    const previousView=view(),active=document.activeElement,focusTop=active?.getBoundingClientRect().top||0,focusedSaved=active?.closest('[data-saved-group]')?.dataset.savedGroup,focusedTool=active?.closest('[data-tool-id],[data-menu-tool-id]')?.dataset.toolId||active?.closest('[data-menu-tool-id]')?.dataset.menuToolId,focusedGroup=active?.closest('details[data-group-id]')?.dataset.groupId,wasHandle=active?.classList.contains('tool-menu-sort-handle'),hadListFocus=scroll.contains(active),wasPin=active?.classList.contains('tool-menu-favorite');
    renderedFavorites=JSON.stringify(readPreferences().favorites);recentButton.disabled=editing();
    if(!draft)expanded=new Set(readMenuExpanded());
    revision++;stopSorting();selected=undefined;root.classList.toggle('is-sorting',editing());button('edit').hidden=editing();root.querySelector('.tool-menu-order-actions').hidden=!editing();root.querySelector('.tool-menu-move-actions').hidden=!editing();button('up').disabled=button('down').disabled=true;
    const query=search.value.trim();
    if(query){const matches=searchNavigation(query,t),primary=matches.filter(item=>!item.secondary),secondary=matches.filter(item=>item.secondary);list.replaceChildren(...primary.map(item=>link(item,true)));if(secondary.length){const heading=document.createElement('p');heading.className='tool-menu-secondary';heading.textContent=t('ux.otherMatches');list.append(heading,...secondary.map(item=>link(item,true)));}}
    else {
      const order=draft||readMenuOrder();
      const groups=order.groups.map(id=>{
        const {key}=toolGroups.find(item=>item.id===id),items=order.items[id].map(id=>pages.find(page=>page.id===id));
        const node=group(t(key),items.map(page=>{if(!draft)return itemRow(page);const row=document.createElement('div');row.className='tool-menu-sort-row';row.dataset.toolId=page.id;row.append(handle(label(page)),...iconText(page.icon,label(page)));return row;}));node.dataset.groupId=id;
        if(draft)node.querySelector('summary').prepend(handle(t(key)));
        node.open=draft?editOpen.has(id):expanded.has(id);
        return node;
      });
      list.replaceChildren(...groups);
      if(draft)void activateSorting(revision);
    }
    renderSaved(query);refreshCurrent();
    empty.hidden=list.children.length!==0;empty.textContent=t('menu.noResults');
    list.setAttribute('aria-label',t('common.navigation'));
    if(hadListFocus){
      const focusRoot=focusedGroup?[...list.children].find(node=>node.dataset.groupId===focusedGroup):focusedSaved?[...saved.children].find(node=>node.dataset.savedGroup===focusedSaved):scroll;
      const row=focusedTool?[...(focusRoot?.querySelectorAll('[data-tool-id],[data-menu-tool-id]')||[])].find(node=>(node.dataset.toolId||node.dataset.menuToolId)===focusedTool):[...list.querySelectorAll('details[data-group-id]')].find(node=>node.dataset.groupId===focusedGroup)?.querySelector('summary');
      const candidate=wasHandle?row?.querySelector('.tool-menu-sort-handle'):wasPin?row?.querySelector('.tool-menu-favorite'):row?.matches('a,summary')?row:row?.querySelector('a');
      (candidate?.checkVisibility()?candidate:row?.closest('details')?.querySelector('summary'))?.focus({preventScroll:true});
    }
    if(query===renderedQuery)restoreView(previousView);else scroll.scrollTop=0;renderedQuery=query;
    if(hadListFocus&&!scroll.contains(document.activeElement)){
      const bounds=scroll.getBoundingClientRect(),visible=node=>{const box=node.getBoundingClientRect();return node.checkVisibility()&&box.top>=bounds.top&&box.bottom<=bounds.bottom;};
      let candidates=[...scroll.querySelectorAll(wasPin?'.tool-menu-favorite':'a,summary')].filter(visible);if(!candidates.length)candidates=[...scroll.querySelectorAll('a,summary')].filter(visible);
      candidates.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-focusTop)-Math.abs(b.getBoundingClientRect().top-focusTop));(candidates[0]||document.getElementById('settings-open'))?.focus({preventScroll:true});
    }
  }
  function translate() {
    refreshFeedback();recentCaption.textContent=t('v2.recent');recentButton.setAttribute('aria-label',t('v2.recent'));recentButton.title=t('v2.recent');if(recent.matches(':popover-open'))renderRecent();
    search.placeholder=t('menu.search');search.setAttribute('aria-label',t('menu.search'));
    root.querySelector('label').textContent=t('menu.search');root.querySelector('.tool-menu-hint').textContent=t(popup?'menu.newTab':'menu.keyboard');const supportLabel=root.querySelector('.tool-menu-support span:last-child');if(supportLabel)supportLabel.textContent=t('support.title');render();
    for(const [id,key]of Object.entries({edit:'sort',save:'done',cancel:'cancel',reset:'reset',up:'up',down:'down'})){button(id).textContent=t('workspace.'+key);}
    if(status.dataset.key)status.textContent=t(status.dataset.key,JSON.parse(status.dataset.params));
  }
  root.addEventListener('click',event=>{
    const pin=event.target.closest('[data-favorite]');if(pin&&!editing()){event.preventDefault();pin.focus({preventScroll:true});toggleFavorite(pin.dataset.favorite);return;}
    if(editing()){const row=event.target.closest('.tool-menu-sort-row,summary');if(row){if(event.target.closest('.tool-menu-sort-handle'))event.preventDefault();selectRow(row.matches('summary')?row.parentElement:row);}if(event.target.closest('a'))event.preventDefault();return;}
    const summary=event.target.closest('summary');
    if(summary?.parentElement.parentElement===list){setExpanded(summary.parentElement,!summary.parentElement.open);return;}
    navigate(event);
  });
  function navigate(event){
    const anchor=event.target.closest('a[data-target]');
    if(!anchor || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
    if(!popup){
      rememberView();
      const url=new URL(anchor.href),page=pages.find(page=>page.file===url.pathname.split('/').pop()),preset=page&&resolveTaskRoute(page.id,url.hash).preset;
      if(preset?url.pathname===location.pathname&&url.hash===location.hash:currentTarget(url.pathname,url.hash)===currentTarget(location.pathname,location.hash))event.preventDefault();
      else if(new URL(anchor.href).pathname!==location.pathname&&hasUserContent()){anchor.target='_blank';anchor.rel='noopener';}
    }
    if(popup){
      // Native anchors preserve modifier/middle-click behavior; normal launch closes the action popup.
      const tabs=globalThis.browser?.tabs || globalThis.chrome?.tabs;
      if(tabs){event.preventDefault();void tabs.create({url:anchor.href}).then(()=>window.close());}
    }else if(recent.contains(anchor))recent.hidePopover();else close();
  }

  root.addEventListener('keydown',event=>{
    if(composing || event.isComposing || event.keyCode===229)return;
    if(editing()&&event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const handle=event.target.closest('.tool-menu-sort-handle');if(handle)selectRow(handle.closest('.tool-menu-sort-row')||handle.closest('details'));move(event.key==='ArrowUp'?-1:1);return;}
    if(event.key==='Escape'){
      event.preventDefault();
      if(editing()){finish(false);return;}
      if(popup)window.close();else close();
      return;
    }
    const rows=[...(editing()?list:scroll).querySelectorAll(editing()?'.tool-menu-sort-handle':'a,summary')].filter(element=>element.checkVisibility());
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
  list.addEventListener('toggle',event=>{
    const node=event.target;if(node.parentElement!==list||!node.matches('details[data-group-id]'))return;
    setExpanded(node,node.open);
  },true);
  list.addEventListener('focusin',event=>{if(editing()&&event.target.matches('.tool-menu-sort-handle'))selectRow(event.target.closest('.tool-menu-sort-row')||event.target.closest('details'));});
  function updatePreferences(){if(recent.matches(':popover-open'))renderRecent();if(!editing()&&renderedFavorites!==JSON.stringify(readPreferences().favorites))render();}
  addEventListener('storage',event=>{if(event.key===preferencesKey)updatePreferences();else if((event.key===menuOrderKey||event.key===menuExpandedKey||event.key===null)&&!editing()){render();if(recent.matches(':popover-open'))renderRecent();}});
  addEventListener('listools:preferences',updatePreferences);
  addEventListener('hashchange',refreshCurrent);
  onLanguageChange(translate);translate();
  return {restoreView(){restoreView(savedView);},open(){render();search.focus({preventScroll:true});},reset(){if(editing())finish(false,false);const filtered=Boolean(search.value);composing=false;search.value='';if(filtered)render();}};
}

export function mountHeaderMenu() {
  const trigger=document.querySelector('button.brand');
  if(!trigger)return;trigger.querySelector('.brand-mark')?.setAttribute('aria-hidden','true');
  const popover=document.createElement('div');popover.id='tool-menu';popover.setAttribute('popover','auto');
  document.body.append(popover);trigger.setAttribute('popovertarget',popover.id);trigger.setAttribute('aria-controls',popover.id);trigger.setAttribute('aria-expanded','false');
  let shell;const menu=mountToolMenu(popover,{close:()=>{if(shell)shell.close();else{popover.hidePopover();trigger.focus();}}});
  shell=mountWorkbenchShell({root:popover,trigger,menu});
  const record=()=>{const target=currentTarget(location.pathname,location.hash),entry=pages.find(page=>page.file===target)||pages.find(page=>page.file===location.pathname.split('/').pop());if(entry)recordRecent(entry.id);};record();requestAnimationFrame(()=>menu.restoreView());addEventListener('hashchange',record);
  function position() {
    const rect=trigger.getBoundingClientRect();
    const left=document.documentElement.dir==='rtl'?rect.right-popover.offsetWidth:rect.left;
    popover.style.left=`${Math.max(8,Math.min(left,innerWidth-popover.offsetWidth-8))}px`;
    popover.style.top=`${rect.bottom+8}px`;
    popover.style.maxHeight=`${Math.max(0,Math.min(560,innerHeight-rect.bottom-16))}px`;
  }
  popover.addEventListener('beforetoggle',event=>{if(event.newState==='closed')menu.reset();});
  popover.addEventListener('toggle',event=>{
    const open=event.newState==='open';trigger.setAttribute('aria-expanded',String(open));
    if(open){position();menu.open();}
  });
  window.addEventListener('resize',()=>{if(popover.hasAttribute('popover')&&popover.matches(':popover-open'))position();});
}
