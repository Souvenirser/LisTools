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
 let panel,timer,slowTimer,done=false,native,restored=false,finishNative;
 const nativeDone=new Promise(resolve=>{finishNative=resolve;});
 function arrive(){native?.skipTransition();finishNative();root.dataset.entryMotion='content';setTimeout(()=>delete root.dataset.entryMotion,240);}
 function show(slow=false,failed=false){
  if(done&&!failed)return;
  if(!document.body){addEventListener('DOMContentLoaded',()=>show(slow,failed),{once:true});return;}
  if(!panel){panel=document.createElement('div');panel.id='page-boot';panel.innerHTML='<div class="boot-header"></div><div class="boot-body"><div class="boot-sidebar"></div><div class="boot-content"><div class="boot-message" role="status"><span></span><button type="button" hidden></button></div><div class="boot-placeholder" aria-hidden="true"></div></div></div>';document.body.append(panel);panel.querySelector('button').onclick=()=>location.reload();}
  panel.querySelector('span').textContent=labels[failed?'loadFailed':slow?'stillLoading':'loading'];const button=panel.querySelector('button');button.textContent=labels.reload;button.hidden=!slow&&!failed;
 }
 function clear(){clearTimeout(timer);clearTimeout(slowTimer);panel?.remove();panel=undefined;}
 function ready(){if(done)return;done=true;clear();root.dataset.uiState='ready';if(native)arrive();else if(!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches){root.dataset.entryMotion='fade';setTimeout(()=>delete root.dataset.entryMotion,240);}}
 function fail(){if(done)return;done=true;clear();native?.skipTransition();finishNative();root.dataset.uiState='failed';show(false,true);}
 window.LisToolsBoot={ready,fail};timer=setTimeout(show,200);slowTimer=setTimeout(()=>{show(true);native?.skipTransition();finishNative();},3000);
 addEventListener('error',event=>{if(root.dataset.uiState==='booting'&&(event.target?.tagName==='SCRIPT'||event.error))fail();},true);
 addEventListener('pagereveal',event=>{
  const transition=event.viewTransition;if(!transition)return;
  transition.ready?.catch(()=>{});
  if(restored||document.hidden||root.dataset.uiState==='ready'||matchMedia('(prefers-reduced-motion:reduce)').matches||typeof transition.waitUntil!=='function'){transition.skipTransition();return;}
  native=transition;root.dataset.nativePhase='waiting';delete root.dataset.entryMotion;
  const release=()=>{if(native!==transition)return;native=undefined;delete root.dataset.nativePhase;};
  transition.finished.then(release,release);
  try{transition.waitUntil(nativeDone);}catch{release();transition.skipTransition();}
 });
 addEventListener('pageshow',event=>{if(event.persisted){restored=true;clear();root.dataset.uiState='ready';delete root.dataset.entryMotion;}});
 addEventListener('pagehide',()=>{clear();finishNative();delete root.dataset.nativePhase;delete root.dataset.entryMotion;});
})();
