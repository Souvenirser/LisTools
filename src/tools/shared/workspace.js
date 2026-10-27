import {t,onLanguageChange} from '../../i18n.js';

export function revealSection(section){
 const target=section.querySelector('h2,h3')||section;
 if(target.tabIndex<0)target.tabIndex=-1;target.focus({preventScroll:true});
 target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}

export function mountResultShortcut(actions,target,hasResult,labelKey='direct.shared.viewResult'){
 const button=document.createElement('button');button.id=target.id+'-shortcut';button.type='button';button.hidden=true;actions.append(button);
 const media=matchMedia('(max-width:1099px), (max-height:800px)');let frame;
 function refresh(){
  button.textContent=t(labelKey);const hidden=!media.matches||!hasResult()||!target.checkVisibility();if(button.hidden!==hidden)button.hidden=hidden;
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);}
 button.onclick=()=>revealSection(target);
 new MutationObserver(schedule).observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['data-status','hidden','aria-busy']});
 media.addEventListener('change',schedule);onLanguageChange(schedule);refresh();return button;
}

export function actionArea(actions,status=document.getElementById('tool-status'),{resultTarget,hasResult=()=>false,choose}={}){
 actions.classList.add('workspace-actions');
 const area=document.createElement('div');area.className='workspace-action-area';actions.before(area);area.append(actions);if(status)area.append(status);
 const media=matchMedia('(max-width:1099px), (max-height:800px)'),target=typeof resultTarget==='string'?document.querySelector(resultTarget):resultTarget;
 let importButton,viewButton,frame;
 if(choose){importButton=document.createElement('button');importButton.type='button';importButton.className='primary workspace-import-action';importButton.hidden=true;importButton.onclick=()=>choose.click();area.prepend(importButton);}
 if(target){viewButton=document.createElement('button');viewButton.type='button';viewButton.className='primary workspace-view-result';viewButton.hidden=true;viewButton.onclick=()=>revealSection(target);area.prepend(viewButton);}
 const hide=(node,value)=>{if(node&&node.hidden!==value)node.hidden=value;};
 function resize(){
   const keyboard=visualViewport&&visualViewport.height<innerHeight*.7;
   const fixed=media.matches&&!keyboard&&!document.body.classList.contains('workspace-focused');
   document.body.classList.toggle('workspace-mobile',fixed);area.classList.toggle('workspace-action-fixed',fixed);
   const busy=Boolean(actions.querySelector('button[id$="-cancel"]:not(:disabled),button#cancel:not(:disabled)'))||status?.dataset.taskState==='pending';
   const valid=Boolean(target&&hasResult()&&!target.hidden),heading=target?.querySelector('h2,h3')||target,box=heading?.getBoundingClientRect(),header=document.querySelector('.app-header')?.getBoundingClientRect();
   const failed=status&&!status.hidden&&(status.classList.contains('is-error')||status.classList.contains('tool-error'));
   const visible=valid&&!failed&&target.checkVisibility()&&box.top>=Math.max(0,header?.bottom||0)&&box.bottom<=innerHeight-72;
   const empty=Boolean(choose&&document.querySelector('.media-workspace:not(.has-files)'));
   const state=!fixed?'inline':busy?'pending':valid?visible?'result-visible':'result':empty?'choose':'input';
   if(area.dataset.actionState!==state)area.dataset.actionState=state;
   hide(actions,fixed&&['choose','result','result-visible'].includes(state));
   actions.classList.toggle('is-busy',fixed&&busy);
   hide(importButton,state!=='choose');hide(viewButton,state!=='result');
   if(importButton&&importButton.textContent!==choose.textContent)importButton.textContent=choose.textContent;
   if(viewButton)viewButton.textContent=t('direct.shared.viewResult');
   const height=fixed&&state!=='result-visible'?area.getBoundingClientRect().height:0;
   const property=`${height}px`;if(document.documentElement.style.getPropertyValue('--workspace-action-height')!==property)document.documentElement.style.setProperty('--workspace-action-height',property);
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(resize);}
 new ResizeObserver(schedule).observe(area);media.addEventListener('change',schedule);visualViewport?.addEventListener('resize',schedule);document.querySelector('main')?.addEventListener('scroll',schedule,{passive:true});addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
 const observer=new MutationObserver(schedule);observer.observe(actions,{subtree:true,attributes:true,attributeFilter:['disabled','hidden']});
 if(status)observer.observe(status,{childList:true,attributes:true,attributeFilter:['class','hidden','data-task-state']});
 if(target)observer.observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 if(choose)observer.observe(choose,{childList:true,attributes:true,attributeFilter:['class']});
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});onLanguageChange(schedule);resize();
 // Only an explicit run requests error positioning; automatic jobs stay where they are.
 let requested=false;
 document.getElementById('tool-root')?.addEventListener('input',()=>{requested=false;});
 actions.addEventListener('click',event=>{if(event.target.closest('button.primary'))requested=true;});
 if(status)new MutationObserver(()=>{
   if(['ready','idle','cancelled','empty'].includes(status.dataset.taskState)){requested=false;return;}
   if(!requested||status.hidden)return;
   if(status.classList.contains('is-error')||status.classList.contains('tool-error')){requested=false;const field=document.getElementById(status.dataset.field),node=field||status;if(!field)node.tabIndex=-1;node.focus({preventScroll:true});node.scrollIntoView({block:'nearest'});}
 }).observe(status,{childList:true,attributes:true,attributeFilter:['class','hidden','data-task-state']});
 return area;
}
export function mediaWorkspace(id,options={}){
 const root=document.getElementById('tool-root'),drop=document.getElementById(`${id}-drop`),queue=document.getElementById(`${id}-queue`).closest('section'),settings=document.getElementById(`${id}-run`).closest('section');
 const layout=document.createElement('div');layout.className='media-workspace';drop.before(layout);
 const input=document.createElement('div');input.className='workspace-input';layout.append(input);input.append(drop,queue);
 settings.classList.add('workspace-options');layout.append(settings);
 const count=document.createElement('span');count.className='queue-count';const heading=queue.querySelector('h2'),title=document.createElement('span');title.dataset.i18n=heading.dataset.i18n;title.textContent=heading.textContent;heading.removeAttribute('data-i18n');heading.replaceChildren(title,count);
 const refreshCount=()=>{const total=queue.querySelectorAll('.media-file-name').length;queue.hidden=!queue.querySelector('.media-file-name,.is-error');layout.classList.toggle('has-files',total>0);document.getElementById(id+'-choose')?.classList.toggle('primary',total===0);const reason=document.getElementById(id+'-run-reason');if(reason)reason.hidden=Number(reason.dataset.applicableCount??total)>0;count.textContent=` · ${document.querySelectorAll(`#${id}-queue li:not(.is-error) .media-file-name`).length}`;};new MutationObserver(refreshCount).observe(document.getElementById(`${id}-queue`),{childList:true});refreshCount();
 const fileInput=document.getElementById(id+'-files'),choose=document.createElement('button');choose.id=id+'-choose';choose.type='button';choose.dataset.i18n=id==='images'?'ux.chooseImages':'ux.choosePdf';const dropLabel=drop.querySelector('.media-drop');if(dropLabel)dropLabel.replaceWith(choose);else fileInput.before(choose);choose.className='media-drop';fileInput.hidden=true;choose.onclick=()=>fileInput.click();drop.querySelector('h2')?.classList.add('sr-only');
 const reason=document.createElement('p');reason.id=id+'-run-reason';reason.className='tool-note';reason.dataset.i18n='ux.addFiles';document.getElementById(id+'-run').closest('.tool-actions').before(reason);
 const actions=actionArea(document.getElementById(`${id}-run`).closest('.tool-actions'),document.getElementById('tool-status'),{...options,choose});
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

export function queueHandle(name){const handle=document.createElement('button');handle.type='button';handle.className='queue-drag-handle';handle.textContent='⠿';handle.setAttribute('aria-label',t('workspace.sortHandle',{name}));return handle;}
export async function sortableQueue(list,onMove){const {default:Sortable}=await import('sortablejs');new Sortable(list,{draggable:'.media-queue-row',handle:'.queue-drag-handle',delay:200,delayOnTouchOnly:true,touchStartThreshold:5,animation:matchMedia('(prefers-reduced-motion:reduce)').matches?0:150,ghostClass:'tool-menu-sort-ghost',onEnd:event=>{if(event.oldDraggableIndex!==event.newDraggableIndex)onMove(event.oldDraggableIndex,event.newDraggableIndex);}});}
