import { t, translateDOM, onLanguageChange } from '../../i18n.js';
import {registerContentCheck} from './content-state.js';
import { showError } from './office.js';
import {taskRoutes,resolveTaskRoute} from './navigation.js';

export function addTaskGuide(id,tasks,{choose,example,hasContent,initialTask,beforeChoose,applyPreset}){
  if(hasContent)registerContentCheck(hasContent);
  const guide=document.createElement('section');guide.className='tool-card task-guide';
  guide.innerHTML=`<div class="task-choices">${tasks.map(task=>`<button id="${id}-task-${task.id}" data-task="${task.id}" data-i18n="${task.key}" aria-pressed="false"></button>`).join('')}</div><details class="task-help"><summary data-i18n="ux.instructions"></summary><p class="tool-note" data-i18n="office.steps"></p></details><button id="${id}-example" data-i18n="ux.viewExample"></button><p class="tool-note" id="${id}-example-note" data-i18n="office.exampleNotice" hidden></p>`;
  if(!example){guide.querySelector(`#${id}-example`).remove();guide.querySelector(`#${id}-example-note`).remove();guide.querySelector('.task-help').remove();}
  let picker;
  if(tasks.length>=4){
    guide.classList.add('has-task-select');
    const label=document.createElement('label');label.className='task-select-label';
    label.innerHTML=`<span data-i18n="${id==='pdf'?'experience.task':'office.chooseTask'}"></span><select id="${id}-task-select">${tasks.map(task=>`<option value="${task.id}" data-i18n="${task.key}"></option>`).join('')}</select>`;
    guide.prepend(label);picker=label.querySelector('select');picker.onchange=()=>activate(picker.value,true);
  }
  document.querySelector('.tool-heading,.page-heading').after(guide);
  let selected=tasks[0].id;const routed=Boolean(taskRoutes[id]),requestedHash=location.hash.slice(1);let initialized=false;
  function select(value,write=true){if(!tasks.some(task=>task.id===value))return;const changed=selected!==value;selected=value;if(initialized&&write&&changed&&routed)history.replaceState(null,'','#'+value);if(picker)picker.value=value;for(const button of guide.querySelectorAll('[data-task]'))button.setAttribute('aria-pressed',String(button.dataset.task===value));}
  function activate(value,push=false,initial=false){
    const route=resolveTaskRoute(id,value),preset=route.preset;
    const next=tasks.some(task=>task.id===(route.task||value))?route.task||value:tasks[0].id;
    const changed=next!==selected,presetChanged=preset&&document.getElementById(preset.control)?.value!==preset.value;
    if(!initial&&!changed&&!presetChanged)return;
    if(next!==selected&&beforeChoose?.(next,selected)===false){if(picker)picker.value=selected;if(routed&&location.hash!=='#'+selected)history.replaceState(null,'','#'+selected);return;}
    if(push&&routed&&location.hash!=='#'+next)history.pushState(null,'','#'+next);select(next,false);if(changed||initial)choose(next,{fromRoute:!push});if(presetChanged)applyPreset?.(preset);for(let node=guide.querySelector('[data-task="'+next+'"]')?.parentElement;node&&node!==guide;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  }
  for(const button of guide.querySelectorAll('[data-task]'))button.onclick=()=>activate(button.dataset.task,true);
  if(routed)addEventListener('hashchange',()=>activate(location.hash.slice(1)));
  queueMicrotask(()=>{initialized=true;if(initialTask||routed&&requestedHash)activate(initialTask||requestedHash,false,true);});
  if(example)document.getElementById(`${id}-example`).onclick=async()=>{
    if(hasContent?.()&&!confirm(t('office.exampleConfirm')))return;
    document.getElementById(`${id}-example-note`).hidden=false;
    try{await example(selected);}catch(error){showError(error);}
  };
  const translate=()=>translateDOM(guide);onLanguageChange(translate);translate();select(selected);
  return {select,clearPreset(){if(resolveTaskRoute(id,location.hash).preset)history.replaceState(null,'','#'+selected);}};
}
