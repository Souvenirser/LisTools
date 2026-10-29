import {t,onLanguageChange} from '../../i18n.js';
import './horizontal-reader.css';

// Native scrolling and selection, with buttons that remain usable when OS scrollbars hide.
export function mountHorizontalReader(value,{label,summary,host,compact=false}={}){
 const controls=document.createElement('div'),hint=document.createElement('span'),buttons=document.createElement('span');
 controls.className='horizontal-reader-controls';controls.setAttribute('aria-live','off');buttons.className='horizontal-reader-buttons';hint.className='horizontal-reader-hint';
 const left=document.createElement('button'),right=document.createElement('button');
 for(const [button,direction,symbol]of [[left,'left','←'],[right,'right','→']]){
  button.type='button';button.dataset.scroll=direction;button.textContent=symbol;
  button.onclick=()=>{value.scrollLeft+=Math.max(80,value.clientWidth*.8)*(direction==='left'?-1:1);refresh();};buttons.append(button);
 }
 controls.append(hint,buttons);if(host)host.append(controls);else value.after(controls);
 value.classList.add('horizontal-reader-value');value.dir='ltr';if(!value.matches('input,textarea'))value.tabIndex=0;
 let frame;
 function refresh(){
  const max=Math.max(0,value.scrollWidth-value.clientWidth),position=Math.max(0,value.scrollLeft),before=position>1,after=position<max-1,overflow=max>1;
  value.dataset.overflow=String(overflow);value.dataset.moreLeft=String(before);value.dataset.moreRight=String(after);
  left.disabled=!before;right.disabled=!after;buttons.style.visibility=overflow?'visible':'hidden';
  controls.hidden=!overflow&&!summary&&!compact;controls.classList.toggle('is-empty',!overflow&&!summary);
  hint.textContent=[summary?.(),overflow?t(before&&after?'reading.moreBoth':before?'reading.moreLeft':'reading.moreRight'):''].filter(Boolean).join(' · ');
  for(const [button,key]of [[left,'left'],[right,'right']]){button.setAttribute('aria-label',`${t('reading.'+key)} · ${label()}`);button.title=button.getAttribute('aria-label');}
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);};
 const resize=new ResizeObserver(schedule),changes=new MutationObserver(schedule);resize.observe(value);changes.observe(value,{childList:true,characterData:true,subtree:true});value.addEventListener('scroll',schedule,{passive:true});value.addEventListener('keydown',event=>{if(value.matches('textarea,input'))return;if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();value.scrollLeft=event.key==='Home'?0:event.key==='End'?value.scrollWidth:value.scrollLeft+(event.key==='ArrowLeft'?-80:80);refresh();}});
 const unsubscribe=onLanguageChange(refresh);schedule();
 return {controls,refresh:schedule,destroy(){cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();value.removeEventListener('scroll',schedule);unsubscribe();controls.remove();}};
}
