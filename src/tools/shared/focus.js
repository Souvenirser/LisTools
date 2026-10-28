import {EditorView} from '@codemirror/view';
import {t,onLanguageChange} from '../../i18n-runtime.js';
import './focus.css';

export function mountWorkspaceFocus(){
 const heading=document.querySelector('.page-heading,.tool-heading');if(!heading)return;
 const button=document.createElement('button');button.type='button';button.id='workspace-focus';button.className='workspace-focus-trigger';button.setAttribute('aria-pressed','false');heading.classList.add('has-workspace-focus');heading.append(button);
 const bar=document.createElement('div');bar.className='workspace-focus-bar';const title=document.createElement('strong');bar.append(title);document.querySelector('main').prepend(bar);
 let active=false,scrollTop=0;
 function refresh(){button.textContent=t(active?'workspace.exitFocus':'workspace.focus');button.setAttribute('aria-label',button.textContent);button.title=button.textContent;title.textContent=document.querySelector('h1').textContent;fitReaders();}
 let measuring;
 function fitReaders(){cancelAnimationFrame(measuring);measuring=requestAnimationFrame(()=>{
  const main=document.querySelector('main'),footer=document.querySelector('.workbench-footer'),narrow=innerWidth<=1000;
  for(const reader of document.querySelectorAll('.diff-source,#convert-source,#convert-result,#regex-source,#regex-output,#text-input,#text-result')){
   if(!reader.checkVisibility())continue;
   const minimum=active&&!narrow?Math.ceil(innerHeight*.7)+2:narrow?240:reader.classList.contains('diff-source')&&innerHeight>=850?440:320;
   let reserve=(footer?.checkVisibility()?footer.getBoundingClientRect().height:0)+24;
   for(let sibling=reader.nextElementSibling;sibling;sibling=sibling.nextElementSibling)if(sibling.checkVisibility()){const style=getComputedStyle(sibling);reserve+=sibling.getBoundingClientRect().height+parseFloat(style.marginTop)+parseFloat(style.marginBottom);}
   const top=reader.getBoundingClientRect().top+main.scrollTop,height=Math.max(minimum,Math.floor(main.getBoundingClientRect().bottom-top-reserve));
   if(reader.style.getPropertyValue('--reader-height')!==`${height}px`)reader.style.setProperty('--reader-height',`${height}px`);
   if(reader.id==='convert-source'&&document.body.classList.contains('md5-page'))reader.closest('.convert-editors').style.setProperty('--md5-reader-height',`${height}px`);
  }
 });}
 const sizing=new ResizeObserver(fitReaders);
 for(const node of document.querySelectorAll('main,.panel-heading,.panel-footer,.page-heading,.tool-heading,.task-guide,.text-workspace-controls,.regex-workspace-controls,#md5-controls,#tool-options'))sizing.observe(node);
 addEventListener('resize',fitReaders);document.addEventListener('toggle',fitReaders,true);document.addEventListener('change',fitReaders);onLanguageChange(fitReaders);fitReaders();
 function setFocus(value){active=value;const main=document.querySelector('main');if(value)scrollTop=main.scrollTop;document.body.classList.toggle('workspace-focused',value);button.setAttribute('aria-pressed',String(value));(value?bar:heading).append(button);refresh();button.focus({preventScroll:true});for(const node of document.querySelectorAll('.cm-editor'))EditorView.findFromDOM(node)?.requestMeasure();requestAnimationFrame(()=>{main.scrollTop=value?0:scrollTop;dispatchEvent(new Event('resize'));});}
 button.onclick=()=>setFocus(!active);
 document.addEventListener('keydown',event=>{if(!active||event.key!=='Escape'||event.defaultPrevented||event.isComposing||document.querySelector(':popover-open,dialog[open],.cm-search'))return;event.preventDefault();setFocus(false);});
 function available(){const files=document.body.classList.contains('md5-page')&&document.getElementById('md5-mode')?.value==='files';if(files&&active)setFocus(false);button.hidden=files;fitReaders();}
 document.addEventListener('change',available);addEventListener('hashchange',available);new MutationObserver(available).observe(document.body,{attributes:true,attributeFilter:['class']});onLanguageChange(refresh);refresh();available();
}
