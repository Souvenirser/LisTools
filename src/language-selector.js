import Choices from 'choices.js';
import 'choices.js/public/assets/styles/choices.min.css';
import './language-selector.css';

// Keep only the flags used by our language list; no global flag stylesheet or CDN.
const flags=import.meta.glob('../node_modules/flag-icons/flags/4x3/{cn,us,es,fr,de,br,ru,jp,kr,sa,in,bd,pk,id,my,vn,th,tr,ir,it,nl,pl,ua,ro,cz,hu,gr,se,dk,fi,no,il,tz,ph,np,lk,mm,kh,et,ng,za}.svg',{eager:true,import:'default',query:'?url&no-inline'});

export function mountLanguageSelector(header,{languages,t,language,setLanguage}) {
  const container=document.createElement('div');container.className='language-control';
  const caption=document.createElement('label');caption.className='language-caption';caption.id='language-caption';caption.htmlFor='language';caption.dataset.i18n='common.language';
  const select=document.createElement('select');select.id='language';
  for(const {code,name,dir} of languages) {
    const option=document.createElement('option');option.value=code;option.textContent=name;option.lang=code;option.dir=dir;option.selected=code===language();select.append(option);
  }
  container.append(caption,select);header.append(container);
  const byCode=new Map(languages.map(item=>[item.code,item]));
  function decorate(element,choice) {
    const meta=byCode.get(choice.value);
    if(!meta)return element;
    const img=document.createElement('img');img.src=flags[`../node_modules/flag-icons/flags/4x3/${meta.flag}.svg`];img.width=20;img.height=15;img.alt='';img.setAttribute('aria-hidden','true');
    const name=document.createElement('bdi');name.textContent=meta.name;name.lang=meta.code;name.dir=meta.dir;
    element.replaceChildren(img,name);return element;
  }
  const choices=new Choices(select,{
    allowHTML:false,shouldSort:false,searchFields:['label','value'],searchResultLimit:50,renderChoiceLimit:-1,
    itemSelectText:'',labelId:caption.id,searchPlaceholderValue:t('common.languageSearch'),
    noResultsText:()=>t('common.languageNoResults'),noChoicesText:()=>t('common.languageNoResults'),
    callbackOnCreateTemplates(){
      return Object.fromEntries(['item','choice'].map(type=>[type,(...args)=>decorate(Choices.defaults.templates[type].call(this,...args),args[1])]));
    }
  });
  const control=container.querySelector('.choices'),search=container.querySelector('input[type="search"]');
  let request=0;
  function refresh() {
    caption.textContent=t('common.language');
    control.dir=byCode.get(language()).dir;
    search.placeholder=t('common.languageSearch');search.setAttribute('aria-label',t('common.languageSearch'));
    select.setAttribute('aria-label',t('common.language'));
    choices.setChoiceByValue(language());
  }
  select.addEventListener('change',async()=>{
    const sequence=++request;
    try {await setLanguage(select.value,true);}
    catch {if(sequence===request)refresh();}
  });
  select.addEventListener('hideDropdown',()=>choices.clearInput());
  refresh();return refresh;
}
