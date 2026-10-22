import { t, translateDOM, onLanguageChange } from '../../i18n.js';
import {registerContentCheck} from './content-state.js';
import { showError } from './office.js';

export function addTaskGuide(id,tasks,{choose,example,hasContent}){
  if(hasContent)registerContentCheck(hasContent);
  const guide=document.createElement('section');guide.className='tool-card task-guide';
  guide.innerHTML=`<div class="task-choices">${tasks.map(task=>`<button id="${id}-task-${task.id}" data-task="${task.id}" data-i18n="${task.key}" aria-pressed="false"></button>`).join('')}</div><details class="task-help"><summary data-i18n="office.advanced"></summary><p class="tool-note" data-i18n="office.steps"></p></details><button id="${id}-example" data-i18n="office.tryExample"></button><p class="tool-note" id="${id}-example-note" data-i18n="office.exampleNotice" hidden></p>`;
  document.querySelector('.tool-heading,.page-heading').after(guide);
  let selected=tasks[0].id;
  function select(value){selected=value;for(const button of guide.querySelectorAll('[data-task]'))button.setAttribute('aria-pressed',String(button.dataset.task===value));}
  for(const button of guide.querySelectorAll('[data-task]'))button.onclick=()=>{select(button.dataset.task);choose(selected);};
  document.getElementById(`${id}-example`).onclick=async()=>{
    if(hasContent?.()&&!confirm(t('office.exampleConfirm')))return;
    document.getElementById(`${id}-example-note`).hidden=false;
    try{await example(selected);}catch(error){showError(error);}
  };
  const translate=()=>translateDOM(guide);onLanguageChange(translate);translate();select(selected);
  return {select};
}
