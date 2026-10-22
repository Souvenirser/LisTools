import Choices from 'choices.js';
import {getCountryCode} from '@vvo/tzdb';
import 'choices.js/public/assets/styles/choices.min.css';

const flags=import.meta.glob('../node_modules/flag-icons/flags/4x3/[a-z][a-z].svg',{eager:true,import:'default',query:'?url&no-inline'});

export function mountTimeZoneSelector(select,{t,language}) {
  let zones=[],metadata=new Map();
  function decorate(element,choice,type) {
    const meta=metadata.get(choice.value);
    if(!meta)return element;
    const mark=document.createElement(meta.flag?'img':'span');
    if(meta.flag){mark.src=meta.flag;mark.width=20;mark.height=15;mark.alt='';}
    else mark.textContent='🌐';
    mark.className='timezone-flag';mark.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.className='timezone-option-text';
    const name=document.createElement('span');name.textContent=type==='item'?meta.selectedLabel:meta.label;
    text.append(name);
    if(type==='choice'){const id=document.createElement('bdi');id.dir='ltr';id.textContent=choice.value;text.append(id);}
    element.title=meta.selectedLabel;element.replaceChildren(mark,text);return element;
  }
  const choices=new Choices(select,{
    allowHTML:false,shouldSort:false,itemSelectText:'',labelId:'timezone-caption',
    searchFields:['label','value','customProperties.search'],searchResultLimit:100,renderChoiceLimit:-1,
    fuseOptions:{threshold:0.1,ignoreLocation:true},
    searchPlaceholderValue:t('timestamp.zoneSearch'),
    noResultsText:()=>t('timestamp.zoneNoResults'),noChoicesText:()=>t('timestamp.zoneNoResults'),
    callbackOnCreateTemplates(){return Object.fromEntries(['item','choice'].map(type=>[type,(...args)=>decorate(Choices.defaults.templates[type].call(this,...args),args[1],type)]));}
  });
  const control=select.closest('.choices'),search=control.querySelector('input[type=search]');
  function setZones(values,value=select.value) {
    zones=[...values];
    const regions=new Intl.DisplayNames([language()],{type:'region'}),english=new Intl.DisplayNames(['en'],{type:'region'});
    const entries=zones.map(zone=>{
      const code=getCountryCode(zone),country=code?regions.of(code):'',city=zone.split('/').at(-1).replaceAll('_',' ');
      const label=country?`${country} · ${city}`:zone;
      const meta={label,selectedLabel:country?`${country} · ${zone}`:zone,flag:code?flags[`../node_modules/flag-icons/flags/4x3/${code.toLowerCase()}.svg`]:undefined};
      return {value:zone,label,selected:zone===value,customProperties:{search:[zone.replaceAll('_',' '),code,code?english.of(code):''].join(' ')},meta};
    }).sort((a,b)=>a.value==='UTC'?-1:b.value==='UTC'?1:a.label.localeCompare(b.label,language())||a.value.localeCompare(b.value));
    metadata=new Map(entries.map(entry=>[entry.value,entry.meta]));
    choices.setChoices(entries,'value','label',true,true,true);
    control.dir=document.documentElement.dir;
    control.setAttribute('aria-describedby',select.getAttribute('aria-describedby'));
    select.setAttribute('aria-label',t('timestamp.zone'));
    search.placeholder=t('timestamp.zoneSearch');search.setAttribute('aria-label',t('timestamp.zoneSearch'));
  }
  select.addEventListener('hideDropdown',()=>choices.clearInput());
  return {setZones,refresh(){setZones(zones);}};
}
