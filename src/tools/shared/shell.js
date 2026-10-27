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
 const aside=document.createElement('aside');aside.id='workbench-navigation';aside.setAttribute('aria-label',t('common.navigation'));layout.prepend(aside);
 const search=document.createElement('button');search.id='global-search-open';search.className='header-search';search.type='button';const mark=createMenuIcon('text-search'),caption=document.createElement('span'),hint=document.createElement('kbd');hint.setAttribute('aria-hidden','true');hint.textContent=/Mac/.test(navigator.platform)?'⌘ K':'Ctrl K';search.append(mark,caption,hint);header.append(search);
 root.querySelector('#tool-menu-search').addEventListener('focus',()=>root.classList.add('is-searching'));
 let origin=trigger;
 function open(from=search){origin=from;root.classList.add('is-searching');if(root.hasAttribute('popover'))root.showPopover();menu.open();}
 function close(){root.classList.remove('is-searching');if(root.hasAttribute('popover')&&root.matches(':popover-open'))root.hidePopover();menu.reset();origin.focus({preventScroll:true});}
 search.onclick=()=>open(search);trigger.onclick=event=>{event.preventDefault();open(trigger);};
 mountSettings(header,{sort:()=>{open();document.getElementById('menu-edit').click();}});
 function layoutMenu(){const wide=innerWidth>=1200;if(wide){if(root.matches(':popover-open'))root.hidePopover();root.removeAttribute('popover');trigger.removeAttribute('popovertarget');if(root.parentElement!==aside)aside.append(root);root.classList.add('is-sidebar');root.classList.toggle('is-compact',innerWidth<1440);for(const key of ['left','top','max-height'])root.style.removeProperty(key);}else{if(root.parentElement!==document.body)document.body.append(root);root.classList.remove('is-sidebar','is-compact','is-searching');root.setAttribute('popover','auto');trigger.setAttribute('popovertarget',root.id);}aside.hidden=!wide;}
 addEventListener('resize',layoutMenu);document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.isComposing){event.preventDefault();open();}});
 function translate(){caption.textContent=t('menu.search');search.setAttribute('aria-label',t('menu.search')+' '+hint.textContent);aside.setAttribute('aria-label',t('common.navigation'));}
 onLanguageChange(translate);translate();layoutMenu();return {open,close};
}
