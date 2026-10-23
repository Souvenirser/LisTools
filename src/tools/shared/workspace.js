import {t,onLanguageChange} from '../../i18n.js';

export function actionArea(actions,status=document.getElementById('tool-status')){
 actions.classList.add('workspace-actions');
 const area=document.createElement('div');area.className='workspace-action-area';actions.before(area);area.append(actions);if(status)area.append(status);
 const media=matchMedia('(max-width:1099px), (max-height:800px)');
 function resize(){
   const keyboard=visualViewport&&visualViewport.height<innerHeight*.7;
   const fixed=media.matches&&!keyboard;
   document.body.classList.toggle('workspace-mobile',fixed);area.classList.toggle('workspace-action-fixed',fixed);
   document.documentElement.style.setProperty('--workspace-action-height',fixed?`${area.getBoundingClientRect().height}px`:'0px');
 }
 new ResizeObserver(resize).observe(area);media.addEventListener('change',resize);visualViewport?.addEventListener('resize',resize);resize();
 // Only an explicit run requests error positioning; automatic jobs stay where they are.
 let requested=false;
 document.getElementById('tool-root')?.addEventListener('input',()=>{requested=false;});
 actions.addEventListener('click',event=>{if(event.target.closest('button.primary'))requested=true;});
 if(status)new MutationObserver(()=>{
   if(['ready','idle','cancelled'].includes(status.dataset.taskState)){requested=false;return;}
   if(!requested||status.hidden)return;
   if(status.classList.contains('is-error')||status.classList.contains('tool-error')){requested=false;status.tabIndex=-1;status.focus({preventScroll:true});if(!media.matches)status.scrollIntoView({block:'nearest'});}
 }).observe(status,{childList:true,attributes:true,attributeFilter:['class','hidden','data-task-state']});
 return area;
}
export function mediaWorkspace(id){
 const root=document.getElementById('tool-root'),drop=document.getElementById(`${id}-drop`),queue=document.getElementById(`${id}-queue`).closest('section'),settings=document.getElementById(`${id}-run`).closest('section');
 const layout=document.createElement('div');layout.className='media-workspace';drop.before(layout);
 const input=document.createElement('div');input.className='workspace-input';layout.append(input);input.append(drop,queue);
 settings.classList.add('workspace-options');layout.append(settings);
 const count=document.createElement('span');count.className='queue-count';const heading=queue.querySelector('h2'),title=document.createElement('span');title.dataset.i18n=heading.dataset.i18n;title.textContent=heading.textContent;heading.removeAttribute('data-i18n');heading.replaceChildren(title,count);
 const refreshCount=()=>{const total=queue.querySelectorAll('.media-file-name').length;queue.hidden=!queue.querySelector('.media-file-name,.is-error');const reason=document.getElementById(id+'-run-reason');if(reason)reason.hidden=total>0;count.textContent=` · ${document.querySelectorAll(`#${id}-queue li:not(.is-error) .media-file-name`).length}`;};new MutationObserver(refreshCount).observe(document.getElementById(`${id}-queue`),{childList:true});refreshCount();
 const fileInput=document.getElementById(id+'-files'),choose=document.createElement('button');choose.id=id+'-choose';choose.type='button';choose.dataset.i18n=id==='images'?'ux.chooseImages':'ux.choosePdf';fileInput.before(choose);fileInput.hidden=true;choose.onclick=()=>fileInput.click();
 const reason=document.createElement('p');reason.id=id+'-run-reason';reason.className='tool-note';reason.dataset.i18n='ux.addFiles';document.getElementById(id+'-run').closest('.tool-actions').before(reason);
 const actions=actionArea(document.getElementById(`${id}-run`).closest('.tool-actions'));
 for(const parent of [input,settings]){
   const notes=parent===input?[...drop.querySelectorAll('.tool-note')]:[...settings.querySelectorAll(':scope > .tool-note:not([data-i18n="images.jpegNotice"]):not([id$="-run-reason"])')];
   if(!notes.length)continue;
   let details=parent===settings?settings.querySelector('details'):null;
   if(!details){details=document.createElement('details');const summary=document.createElement('summary');summary.dataset.i18n=parent===input?'ux.fileLimits':id==='pdf'?'ux.preservation':'ux.advanced';details.append(summary);notes[0].before(details);}
   details.classList.add('workspace-help');details.append(...notes);
 }
 const refresh=()=>{for(const node of root.querySelectorAll('[data-i18n^="ux."]'))node.textContent=t(node.dataset.i18n);choose.dataset.i18n=id==='pdf'&&document.getElementById('pdf-mode').value==='images'?'ux.chooseImages':id==='images'?'ux.chooseImages':'ux.choosePdf';choose.textContent=t(choose.dataset.i18n);if(id==='pdf'){const title=drop.querySelector('h2');title.dataset.i18n=choose.dataset.i18n;title.textContent=t(choose.dataset.i18n);}};if(id==='pdf')document.getElementById('pdf-mode').addEventListener('input',refresh);onLanguageChange(refresh);refresh();refreshCount();
 return actions;
}
