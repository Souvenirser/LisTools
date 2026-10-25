import {t,language,languages} from './i18n-runtime.js';
import {mountToolMenu} from './tools/shared/menu.js';
import './popup.css';

document.documentElement.lang=language();
document.documentElement.dir=languages.find(item=>item.code===language()).dir;
document.getElementById('popup-caption').textContent=t('common.tools');
const menu=document.getElementById('popup-menu');
mountToolMenu(menu,{popup:true}).open();

const maximumHeight=parseFloat(getComputedStyle(menu).maxHeight);
let frame;
function fitPopup(grow=false){
  cancelAnimationFrame(frame);
  // Allow native content sizing to grow the popup before checking its available height.
  if(grow)menu.style.removeProperty('max-height');
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
    const bounds=menu.getBoundingClientRect(),available=Math.max(0,innerHeight-bounds.top);
    menu.style.maxHeight=`${Math.min(maximumHeight,available)}px`;
  });});
}
new MutationObserver(()=>fitPopup(true)).observe(menu,{childList:true,subtree:true});
menu.addEventListener('toggle',()=>fitPopup(true),true);
window.addEventListener('resize',()=>fitPopup());
fitPopup(true);
