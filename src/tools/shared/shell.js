import {t,onLanguageChange,language,languages,setLanguage} from '../../i18n-runtime.js';
import {mountLanguageSelector} from '../../language-selector.js';
import {createMenuIcon} from './icons.js';
import {preferencesKey,readPreferences,savePreferences} from './preferences.js';
import './shell.css';

export function mountSettings(header,{sort=()=>{}}={}){
 const button=document.createElement('button');button.id='settings-open';button.type='button';button.className='header-settings';const caption=document.createElement('span');caption.className='settings-caption';button.append(createMenuIcon('sliders-horizontal'),caption);
 const dialog=document.createElement('dialog');dialog.id='workbench-settings';dialog.setAttribute('aria-labelledby','settings-title');dialog.innerHTML='<div class="settings-heading"><h2 id="settings-title"></h2><button type="button" id="settings-close" class="quiet"></button></div><div id="settings-language"></div><label class="field" for="theme-preference"><span id="theme-label"></span><select id="theme-preference"><option value="system"></option><option value="light"></option><option value="dark"></option></select></label><button type="button" id="settings-sort"></button>';
 header.append(button);document.body.append(dialog);const select=dialog.querySelector('#theme-preference'),close=dialog.querySelector('#settings-close');
 const refreshLanguage=mountLanguageSelector(dialog.querySelector('#settings-language'),{t,language,languages,setLanguage});
 function refresh(){caption.textContent=t('v2.settings');button.setAttribute('aria-label',t('v2.settings'));button.title=t('v2.settings');dialog.querySelector('#settings-title').textContent=t('v2.settings');close.textContent=t('common.close');dialog.querySelector('#theme-label').textContent=t('v2.appearance');for(const [value,key]of [['system','themeSystem'],['light','themeLight'],['dark','themeDark']])select.querySelector(`[value="${value}"]`).textContent=t('v2.'+key);select.value=readPreferences().theme;dialog.querySelector('#settings-sort').textContent=t('workspace.sort');refreshLanguage();}
 button.onclick=()=>{refresh();button.focus({preventScroll:true});dialog.showModal();};close.onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 // Choices closes its dropdown on Escape; suppress the dialog default for that same key.
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&event.target.closest('.choices[aria-expanded="true"]'))event.preventDefault();},true);
 select.onchange=()=>savePreferences({...readPreferences(),theme:select.value});dialog.querySelector('#settings-sort').onclick=()=>{dialog.close();sort();};
 addEventListener('storage',event=>{if(event.key===preferencesKey||event.key===null)select.value=readPreferences().theme;});onLanguageChange(refresh);refresh();
 return dialog;
}

export function mountWorkbenchShell({root,trigger,menu}){
 const header=document.querySelector('.app-header'),layout=document.querySelector('.app-layout');if(!header||!layout)return;
 document.body.classList.add('workbench-shell');
 const search=document.createElement('button');search.id='global-search-open';search.className='header-search';search.type='button';const mark=createMenuIcon('text-search'),caption=document.createElement('span'),hint=document.createElement('kbd');hint.setAttribute('aria-hidden','true');hint.textContent=/Mac/.test(navigator.platform)?'⌘ K':'Ctrl K';search.append(mark,caption,hint);header.append(search);
 search.setAttribute('aria-controls',root.id);search.setAttribute('popovertarget',root.id);
 const settings=mountSettings(header,{sort:()=>{open(document.getElementById('settings-open'));document.getElementById('menu-edit').click();}});
 let origin=trigger;
 function position(){
  const anchor=origin===trigger?trigger:search;
  const rect=anchor.getBoundingClientRect(),width=Math.min(360,innerWidth-16);
  const left=document.documentElement.dir==='rtl'?rect.right-width:rect.left;
  root.style.left=`${Math.max(8,Math.min(left,innerWidth-width-8))}px`;
  root.style.top=`${rect.bottom+8}px`;
  root.style.maxHeight=`${Math.max(0,Math.min(560,innerHeight-rect.bottom-16))}px`;
 }
 function open(from){
  if(root.matches(':popover-open')){menu.open();return;}
  origin=from;
  position();
  root.showPopover();
  menu.open();
 }
 function restoreFocus(){(origin?.checkVisibility()?origin:search).focus({preventScroll:true});}
 function close(){if(root.matches(':popover-open')){root.hidePopover();restoreFocus();}}
 function toggle(from){if(root.matches(':popover-open'))close();else open(from);}
 search.onclick=event=>{
  event.preventDefault();
  const frame=document.activeElement;
  toggle(event.detail===0&&frame?.matches('[data-workspace-active]')?frame.contentDocument.activeElement:search);
 };
 trigger.onclick=event=>{event.preventDefault();toggle(trigger);};
 root.addEventListener('beforetoggle',event=>{
  const opened=event.newState==='open';
  const restore=!opened&&(root.contains(document.activeElement)||document.activeElement===document.body);
  for(const control of [trigger,search])control.setAttribute('aria-expanded',String(opened));
  if(!opened){menu.reset();if(restore)restoreFocus();}
 });
 addEventListener('resize',()=>{if(root.matches(':popover-open'))position();});
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.keyCode===229||settings.open||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='k')return;
  event.preventDefault();
  open(document.activeElement===document.body?search:document.activeElement);
 });
 function translate(){caption.textContent=t('menu.search');search.setAttribute('aria-label',t('menu.search')+' '+hint.textContent);if(root.matches(':popover-open'))position();}
 search.setAttribute('aria-expanded','false');onLanguageChange(translate);translate();return {close};
}
