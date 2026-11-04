import Choices from 'choices.js';
import Papa from 'papaparse';
import {t,language,onLanguageChange,translateDOM} from '../../i18n.js';
import {copyText,downloadText} from '../shared/page.js';
import {cities,policyVersion} from './policy.js';
import {amount,fail,sum} from './money.js';
import './style.css';

export const $=id=>document.getElementById(id);
const attr=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function field(id,key,value='',type='text',extra=''){
 const attributes=type==='text'?`inputmode="${id.endsWith('customName')?'text':'decimal'}" autocomplete="off" spellcheck="false" dir="ltr"`:'';
 return `<div class="field"><label for="${id}" data-i18n="${key}"></label><input id="${id}" type="${type}" value="${attr(value)}" ${attributes} ${extra}></div>`;
}
export function select(id,key,options,value){return `<div class="field"><label for="${id}" data-i18n="${key}"></label><select id="${id}">${options.map(([v,k])=>`<option value="${v}" data-i18n="${k}" ${String(value)===v?'selected':''}></option>`).join('')}</select></div>`;}
export const check=(id,key,checked=false)=>`<label class="payroll-check"><input id="${id}" type="checkbox" ${checked?'checked':''}><span data-i18n="${key}"></span></label>`;
export const note=key=>`<p class="tool-note" data-i18n="${key}"></p>`;
export const value=id=>$(id).value;
export function cityMarkup(prefix){return `<div class="field insurance-picker"><label id="${prefix}-city-label" for="${prefix}-city" data-i18n="payroll.city"></label><select id="${prefix}-city"><option value="" data-i18n="payroll.chooseCity"></option>${cities.map(c=>`<option value="${c.id}">${c.name} · ${c.search.split(' ').slice(2).join(' ')}</option>`).join('')}</select></div>`;}
export function mountCity(prefix){
 const picker=new Choices($(prefix+'-city'),{allowHTML:false,shouldSort:false,itemSelectText:'',labelId:prefix+'-city-label',searchFields:['label','value','customProperties.search'],searchResultLimit:30,noResultsText:()=>t('units.noMatches'),noChoicesText:()=>t('units.noMatches'),fuseOptions:{threshold:.2,ignoreLocation:true}});
 const refresh=()=>{const selected=value(prefix+'-city');picker.setChoices([{value:'',label:t('payroll.chooseCity'),placeholder:true,disabled:true},...[...new Set(cities.map(c=>c.province))].map(province=>({label:province,choices:cities.filter(c=>c.province===province).map(c=>({value:c.id,label:language().startsWith('zh')?c.name:c.name+' · '+c.search.split(' ').slice(2).join(' '),customProperties:{search:c.search}}))}))],'value','label',true,true,true);picker.setChoiceByValue(selected);picker.input.element.setAttribute('aria-label',t('common.search')+' · '+t('payroll.city'));picker.input.element.placeholder=t('common.search')+' · '+t('payroll.city');};
 refresh();onLanguageChange(refresh);return picker;
}
export function deductions(prefix){return `<div class="payroll-deductions">${select(prefix+'-deductionMode','payroll.special',[['total','payroll.totalMode'],['items','payroll.itemMode']],'total')}${field(prefix+'-special','payroll.special','0')}<details id="${prefix}-deductionDetails"><summary data-i18n="payroll.specialDetails"></summary><div class="payroll-fields">${['children','infant','education','rent','mortgage','elderly'].map(k=>field(prefix+'-'+k,'payroll.'+k,'0')).join('')}</div>${note('payroll.deductionHint')}</details></div>`;}
export function mountDeductions(prefix){
 const change=()=>{const items=value(prefix+'-deductionMode')==='items';$(prefix+'-special').closest('.field').hidden=items;$(prefix+'-deductionDetails').hidden=!items;if(items)$(prefix+'-deductionDetails').open=true;};
 $(prefix+'-deductionMode').addEventListener('change',change);change();
 return ()=>{if(value(prefix+'-deductionMode')==='total')return value(prefix+'-special');const values=Object.fromEntries(['children','infant','education','rent','mortgage','elderly'].map(k=>[k,amount(value(prefix+'-'+k),prefix+'-'+k)]));if(values.rent.gt(0)&&values.mortgage.gt(0))fail('tax.housingConflict',prefix+'-mortgage');return sum(Object.values(values)).toFixed(2);};
}
export function taxParameters(prefix){return `<div class="payroll-fields">${field(prefix+'-month','payroll.period',new Date().getMonth()+1,'number','min="1" max="12"')}${field(prefix+'-startMonth','payroll.startMonth','1','number','min="1" max="12"')}</div>${check(prefix+'-firstEmployment','payroll.firstEmployment')}${note('payroll.firstEmploymentHint')}${deductions(prefix)}${field(prefix+'-other','payroll.other','0')}`;}
export function resultsView(prefix){return `<section class="tool-card payroll-result" id="${prefix}-result"><h2 data-i18n="payroll.result"></h2><p id="${prefix}-empty" class="tool-note" data-i18n="payroll.empty"></p><div id="${prefix}-values"></div><div class="tool-actions payroll-exports" id="${prefix}-exports" hidden>${['copyAll','downloadTxt','downloadCsv'].map(k=>`<button id="${prefix}-${k}" data-i18n="payroll.${k}"></button>`).join('')}</div></section>`;}
export function renderRows(prefix,rows){
 const dl=document.createElement('dl');dl.className='payroll-values';
 for(const [key,label,text,main=false] of rows){if(text===null||text===undefined)continue;const group=document.createElement('div');group.className=main?'payroll-value primary-value':'payroll-value';const dt=document.createElement('dt'),dd=document.createElement('dd'),out=document.createElement('output'),copy=document.createElement('button');dt.textContent=t(label);out.dir='ltr';out.dataset.value=key;out.textContent=String(text);copy.type='button';copy.textContent=t('common.copy');copy.setAttribute('aria-label',t('common.copy')+' · '+t(label));copy.onclick=()=>copyText(String(text));dd.append(out,copy);group.append(dt,dd);dl.append(group);}
 $(prefix+'-values').replaceChildren(dl);$(prefix+'-empty').hidden=rows.length>0;$(prefix+'-exports').hidden=rows.length===0;
}
export function attachExports(prefix,getRows,getSnapshot,getDetails=()=>[]){
 const text=()=>getRows().map(([,key,v])=>`${t(key)}: ${v??t('payroll.unknown')}`).join('\n')+(getDetails().length?'\n'+JSON.stringify(getDetails(),null,2):'')+'\n\n'+t('payroll.conditions')+'\n'+JSON.stringify(getSnapshot(),null,2)+'\n'+t('payroll.dataVersion')+': '+policyVersion;
 $(prefix+'-copyAll').onclick=()=>copyText(text());$(prefix+'-downloadTxt').onclick=()=>downloadText(text(),prefix+'-result.txt');$(prefix+'-downloadCsv').onclick=()=>{const data=[...getRows().map(([,key,v])=>({item:t(key),value:v,conditions:JSON.stringify(getSnapshot()),policyVersion})),...getDetails().map(row=>({...row,conditions:JSON.stringify(getSnapshot()),policyVersion}))],fields=[...new Set(data.flatMap(row=>Object.keys(row)))];downloadText(Papa.unparse({fields,data:data.map(row=>fields.map(key=>row[key]??''))},{escapeFormulae:true}),prefix+'-result.csv','text/csv;charset=utf-8');};
}
export function setReady(prefix,ready){$(prefix+'-result').dataset.status=ready?'ready':'idle';$(prefix+'-exports').hidden=!ready;}
export function translate(root=document){translateDOM(root);}
