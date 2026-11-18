import {t,onLanguageChange} from '../../i18n-runtime.js';
import {createMiniView,updateMini} from './view.js';
import {salaryStore} from './store.js';
let floating;
export function isSalaryWindowOpen(){return Boolean(floating&&!floating.closed);}
export async function toggleSalaryWindow(onChange=()=>{}){
 if(isSalaryWindowOpen()){floating.close();onChange();return;}
 if(!globalThis.documentPictureInPicture?.requestWindow)throw {code:'salary.pipUnsupported'};
 try{floating=await documentPictureInPicture.requestWindow({width:360,height:230});}catch{throw {code:'salary.pipFailed'};}
 const win=floating,doc=win.document;doc.title=t('salary.name');doc.body.className='salary-floating';
 for(const node of document.querySelectorAll('link[rel="stylesheet"],style')){const copy=node.cloneNode(true);if(copy.tagName==='LINK')copy.href=node.href;doc.head.append(copy);}
 const view=createMiniView(doc,{floating:true,onClose:()=>win.close()});doc.body.replaceChildren(view);
 const sync=()=>{doc.documentElement.className=document.documentElement.className;doc.documentElement.lang=document.documentElement.lang;doc.documentElement.dir=document.documentElement.dir;updateMini(view);};
 const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','lang','dir']});
 const unsubscribe=salaryStore.subscribe(sync),languageOff=onLanguageChange(sync),timer=win.setInterval(sync,1000);sync();
 win.addEventListener('pagehide',()=>{win.clearInterval(timer);observer.disconnect();unsubscribe();languageOff();if(floating===win)floating=undefined;onChange();},{once:true});onChange();
}
