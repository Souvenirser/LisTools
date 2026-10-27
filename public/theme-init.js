(() => {
 const key='listools-preferences-v1',system=matchMedia('(prefers-color-scheme: dark)');
 function apply(value){let theme=value?.theme;try{if(!theme)theme=JSON.parse(localStorage.getItem(key)||'null')?.theme;}catch{}const dark=theme==='dark'||(!['light','dark'].includes(theme)&&system.matches),root=document.documentElement;root.classList.toggle('dark',dark);root.classList.toggle('jse-theme-dark',dark);root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';dispatchEvent(new Event('listools:theme'));}
 addEventListener('storage',event=>{if(event.key===key||event.key===null)apply();});addEventListener('listools:preferences',event=>apply(event.detail));system.addEventListener('change',()=>apply());apply();
})();
