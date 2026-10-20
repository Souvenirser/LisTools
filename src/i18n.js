import {languages,t,language,onLanguageChange,setLanguage} from './i18n-runtime.js';
import {mountHeaderMenu} from './tools/shared/menu.js';
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
const select=document.createElement('select');
select.id='language';select.setAttribute('data-i18n-aria-label','common.language');
for(const {code,name,dir} of languages){
  const option=document.createElement('option');option.value=code;option.textContent=name;option.lang=code;option.dir=dir;select.append(option);
}
const label=document.createElement('label');label.className='language-control';
const caption=document.createElement('span');caption.dataset.i18n='common.language';
label.append(caption,select);document.querySelector('.app-header').append(label);
select.addEventListener('change',async()=>{
  try{await setLanguage(select.value,true);}catch{select.value=language();}
});
function applyLanguage(){
  document.documentElement.lang=language();
  document.documentElement.dir=languages.find(item=>item.code===language()).dir;
  select.value=language();translateDOM();
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
