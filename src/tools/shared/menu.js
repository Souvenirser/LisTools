import {version,bugs} from '../../../package.json';
import {pages,searchNavigation,currentTarget} from './navigation.js';
import {mountFeedbackLink} from './feedback.js';
import {t,language,onLanguageChange} from '../../i18n-runtime.js';
import './menu.css';
import {hasUserContent} from './content-state.js';

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
  const refreshFeedback=popup?mountFeedbackLink(root.querySelector('.tool-menu-footer'),()=>({
    issuesUrl:bugs.url,tool:'toolbox',version,locale:language(),label:t('common.feedback'),hint:t('common.feedbackHint')
  })):()=>{};
  let composing=false;
  function link(item,searchResult=false) {
    const element=document.createElement('a');element.href=`./${item.file}`;element.dataset.target=item.file;
    element.className='tool-menu-link';element.append(...iconText(item.icon || '⇄',label(item)));
    if(popup||(!popup&&new URL(element.href).pathname!==location.pathname&&hasUserContent())){element.target='_blank';element.rel='noopener';}
    if(!popup && item.file===currentTarget(location.pathname,location.hash))element.setAttribute('aria-current','page');
    if(searchResult && item.category){
      const context=document.createElement('small');context.textContent=item.category[language().startsWith('zh')?0:1];element.querySelector('.tool-menu-name').append(context);
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
    const query=search.value.trim();
    if(query)list.replaceChildren(...searchNavigation(query,t).map(item=>link(item,true)));
    else {
      const groups=[['general','⌗'],['developer','{ }']].map(([id,icon])=>{
        const items=pages.filter(page=>(page.group||'developer')===id);
        const node=group(t(`office.${id}`),icon,items.map(page=>link(page)));
        node.open=id==='general'||Boolean(node.querySelector('[aria-current="page"]'));
        return node;
      });
      list.replaceChildren(...groups);
    }
    empty.hidden=list.children.length!==0;empty.textContent=t('menu.noResults');
    list.setAttribute('aria-label',t('common.navigation'));
  }
  function translate() {
    refreshFeedback();
    search.placeholder=t('menu.search');search.setAttribute('aria-label',t('menu.search'));
    root.querySelector('label').textContent=t('menu.search');root.querySelector('.tool-menu-hint').textContent=t(popup?'menu.newTab':'menu.keyboard');render();
  }
  root.addEventListener('click',event=>{
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
    if(event.key==='Escape'){
      event.preventDefault();
      if(popup)window.close();else close();
      return;
    }
    const rows=[...list.querySelectorAll('a,summary')].filter(element=>element.checkVisibility());
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
  onLanguageChange(translate);translate();
  return {open(){render();search.focus();},reset(){composing=false;search.value='';render();}};
}

export function mountHeaderMenu() {
  const trigger=document.querySelector('button.brand');
  if(!trigger)return;
  const cue=document.createElement('span');cue.className='toolbox-cue';trigger.append(cue);const refreshCue=()=>{cue.textContent=language().startsWith('zh')?'工具箱':t('common.tools');};onLanguageChange(refreshCue);refreshCue();
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
