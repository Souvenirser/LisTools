(() => {
 const key='listools-preferences-v1',system=matchMedia('(prefers-color-scheme: dark)');
 function apply(value){let theme=value?.theme;try{if(!theme)theme=JSON.parse(localStorage.getItem(key)||'null')?.theme;}catch{}const dark=theme==='dark'||(!['light','dark'].includes(theme)&&system.matches),root=document.documentElement;root.classList.toggle('dark',dark);root.classList.toggle('jse-theme-dark',dark);root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';dispatchEvent(new Event('listools:theme'));}
 addEventListener('storage',event=>{if(event.key===key||event.key===null)apply();});addEventListener('listools:preferences',event=>apply(event.detail));system.addEventListener('change',()=>apply());apply();
})();

(() => {
 const root=document.documentElement,catalog=window.LisToolsBootCatalog;
 let saved;try{saved=localStorage.getItem('listools-language');}catch{}
 const code=catalog?.preferred(saved,navigator.languages||[navigator.language])||'en';
 const labels=catalog?.labels[code]||{loading:'Loading page…',stillLoading:'Still loading the page…',loadFailed:'The page could not be loaded.',reload:'Reload'};
 root.lang=code;root.dir=['ar','fa','he','ur'].includes(code)?'rtl':'ltr';root.dataset.uiState='booting';
 let panel,timer,slowTimer,done=false,native=false;
 function show(slow=false,failed=false){
  if(done&&!failed)return;
  if(!document.body){addEventListener('DOMContentLoaded',()=>show(slow,failed),{once:true});return;}
  if(!panel){panel=document.createElement('div');panel.id='page-boot';panel.innerHTML='<div class="boot-header"></div><div class="boot-body"><div class="boot-sidebar"></div><div class="boot-content"><div class="boot-message" role="status"><span></span><button type="button" hidden></button></div><div class="boot-placeholder" aria-hidden="true"></div></div></div>';document.body.append(panel);panel.querySelector('button').onclick=()=>location.reload();}
  panel.querySelector('span').textContent=labels[failed?'loadFailed':slow?'stillLoading':'loading'];const button=panel.querySelector('button');button.textContent=labels.reload;button.hidden=!slow&&!failed;
 }
 function clear(){clearTimeout(timer);clearTimeout(slowTimer);panel?.remove();panel=undefined;}
 function ready(){if(done)return;done=true;clear();root.dataset.uiState='ready';if(!native&&!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches){root.dataset.entryMotion='fade';setTimeout(()=>delete root.dataset.entryMotion,170);}}
 function fail(){if(done)return;done=true;clear();root.dataset.uiState='failed';show(false,true);}
 window.LisToolsBoot={ready,fail};timer=setTimeout(show,200);slowTimer=setTimeout(()=>show(true),3000);
 addEventListener('error',event=>{if(root.dataset.uiState==='booting'&&(event.target?.tagName==='SCRIPT'||event.error))fail();},true);
 addEventListener('pagereveal',event=>{if(!event.viewTransition)return;if(root.dataset.uiState!=='ready'||matchMedia('(prefers-reduced-motion:reduce)').matches)event.viewTransition.skipTransition();else{native=true;delete root.dataset.entryMotion;}});
 addEventListener('pageshow',event=>{if(event.persisted){clear();root.dataset.uiState='ready';delete root.dataset.entryMotion;}});
 addEventListener('pagehide',()=>{clear();delete root.dataset.entryMotion;});
})();
