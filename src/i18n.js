import {languages,t,language,onLanguageChange,setLanguage} from './i18n-runtime.js';
import {mountHeaderMenu} from './tools/shared/menu.js';
import {mountLanguageSelector} from './language-selector.js';
import {feedbackTool,mountFeedbackLink} from './tools/shared/feedback.js';
import {bugs,version} from '../package.json';
export {t,language,onLanguageChange,errorText} from './i18n-runtime.js';

export function translateDOM(root = document) {
  for (const attribute of ['text','placeholder','title','aria-label']) {
    const marker = attribute === 'text' ? 'data-i18n' : `data-i18n-${attribute}`;
    for (const element of root.querySelectorAll(`[${marker}]`)) {
      const value = t(element.getAttribute(marker));
      if (attribute === 'text') element.textContent = value;
      else element.setAttribute(attribute, value);
    }
  }
  for (const button of root.querySelectorAll('[data-copy]')) {
    const label = root.querySelector(`label[for="${button.dataset.copy}"]`)?.textContent || '';
    const text = `${t('common.copy')} · ${label}`;
    button.setAttribute('aria-label', text); button.title = text;
  }
}

mountHeaderMenu();
const feedbackFooter=document.querySelector('.workbench-footer');
const refreshFeedback=feedbackFooter?mountFeedbackLink(feedbackFooter,()=>({
  issuesUrl:bugs.url,tool:feedbackTool(location.pathname,location.hash),version,locale:language(),label:t('common.feedback'),hint:t('common.feedbackHint')
})):()=>{};
onLanguageChange(refreshFeedback);window.addEventListener('hashchange',refreshFeedback);
const refreshLanguageSelector=mountLanguageSelector(document.querySelector('.app-header'),{languages,t,language,setLanguage});
function applyLanguage(){
  document.documentElement.lang=language();
  document.documentElement.dir=languages.find(item=>item.code===language()).dir;
  refreshLanguageSelector();translateDOM();
}
onLanguageChange(applyLanguage);applyLanguage();
export function createNotifier() {
  const element = document.getElementById('notification');
  let timer, current;
  onLanguageChange(() => { if (current && !element.hidden) element.textContent = t(current.key, current.params); });
  return (key, params) => {
    current = { key, params }; clearTimeout(timer);
    element.textContent = t(key, params); element.hidden = false;
    timer = setTimeout(() => { element.hidden = true; current = undefined; }, 3500);
  };
}

function syncCancelControls(){for(const button of document.querySelectorAll('button[id$="-cancel"],button#cancel[disabled]')){const update=()=>{button.hidden=button.disabled;};new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['disabled']});update();}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncCancelControls,{once:true});else queueMicrotask(syncCancelControls);

if(['','index.html','diff.html','convert.html','regex.html','text.html'].includes(location.pathname.split('/').pop())){
 const focus=()=>import('./tools/shared/focus.js').then(module=>module.mountWorkspaceFocus());
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',focus,{once:true});else queueMicrotask(focus);
}
