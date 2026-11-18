import {t,onLanguageChange} from '../../i18n-runtime.js';
import {salaryStore} from './store.js';
import {createMiniView,readSalarySnapshot,updateMini} from './view.js';
import './style.css';
export function mountSalaryBar(){
 if(document.getElementById('salary-bar'))return;
 const bar=document.createElement('aside');bar.id='salary-bar';bar.className='salary-bar';
 const hide=()=>salaryStore.updateDisplay(()=>({showBar:false}));
 const view=createMiniView(document,{compact:true,onClose:hide}),link=document.createElement('a');link.href='./salary.html';link.target='_blank';link.rel='noopener';link.className='salary-bar-open';view.querySelector('.salary-mini-controls').prepend(link);view.querySelector('[data-salary-close]').id='salary-bar-hide';view.querySelector('[data-salary-close]').dataset.i18n='salary.hideBar';bar.append(view);
 const container=document.getElementById('workspace-salary-bar-slot')||document.body;
 container.append(bar);
 const resize=()=>document.documentElement.style.setProperty('--salary-bar-height',bar.hidden?'0px':`${bar.getBoundingClientRect().height}px`);
 function render(){const state=readSalarySnapshot();bar.hidden=!state.config?.enabled||!state.config.showBar;document.body.classList.toggle('salary-bar-visible',!bar.hidden);bar.setAttribute('aria-label',t('salary.barLabel'));link.textContent=t('salary.openDashboard');view.querySelector('[data-salary-close]').setAttribute('aria-label',t('salary.hideBar'));updateMini(view,state);resize();}
 const observer=new ResizeObserver(resize);observer.observe(bar);const off=salaryStore.subscribe(render),languageOff=onLanguageChange(render),timer=setInterval(()=>{if(!document.hidden)render();},1000);
 addEventListener('focus',render);addEventListener('pageshow',render);document.addEventListener('visibilitychange',render);render();
 // A BFCache page can resume its same observer and interval; do not tear it down on pagehide.
 addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);observer.disconnect();off();languageOff();}},{once:true});
}
