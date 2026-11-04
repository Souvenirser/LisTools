import {mountSettings} from './tools/shared/shell.js';
import {t,language,languages,onLanguageChange} from './i18n-runtime.js';
import {mountToolMenu} from './tools/shared/menu.js';
import './popup.css';

document.documentElement.lang=language();
document.documentElement.dir=languages.find(item=>item.code===language()).dir;
document.getElementById('popup-caption').textContent=t('common.tools');
const menu=document.getElementById('popup-menu');
mountToolMenu(menu,{popup:true}).open();
mountSettings(document.querySelector('.popup-header'),{sort:()=>document.getElementById('menu-edit').click()});
onLanguageChange(()=>{document.documentElement.lang=language();document.documentElement.dir=languages.find(item=>item.code===language()).dir;document.getElementById('popup-caption').textContent=t('common.tools');});

const maximumHeight=parseFloat(getComputedStyle(menu).maxHeight);
const maximumPopupHeight=maximumHeight+document.querySelector('.popup-header').offsetHeight;
const nativePopup=Boolean(globalThis.chrome?.runtime?.id);
let frame,previousScale;
function fitPopup(){
  if(frame!==undefined)return;
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
    frame=undefined;
    const bounds=menu.getBoundingClientRect(),scale=bounds.width/menu.offsetWidth||1;
    const preferred=Math.min(maximumHeight,Math.max(0,maximumPopupHeight-bounds.top)/scale);
    const current=parseFloat(menu.style.maxHeight);
    // Release a previous limit when the content scale or available viewport grows.
    if(nativePopup&&current!==preferred&&((previousScale!==undefined&&scale!==previousScale)||bounds.bottom<innerHeight-1)){
      menu.style.maxHeight=`${preferred}px`;previousScale=scale;fitPopup();return;
    }
    previousScale=scale;
    // Wait for Chrome's auto-size, then constrain only genuine overflow. Keeping
    // an intermediate fitting height as a limit would stop the opening animation.
    if(!nativePopup||bounds.bottom>innerHeight+1){
      const available=Math.max(0,innerHeight-bounds.top)/scale;
      menu.style.maxHeight=`${Math.min(preferred,available)}px`;
    }else if(!Number.isFinite(current)||current>preferred)menu.style.maxHeight=`${preferred}px`;
  });});
}
new MutationObserver(fitPopup).observe(menu,{childList:true,subtree:true});
new ResizeObserver(fitPopup).observe(menu);
menu.addEventListener('toggle',fitPopup,true);
window.addEventListener('resize',()=>fitPopup());
fitPopup();
