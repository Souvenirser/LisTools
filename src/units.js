import {mountHorizontalReader} from './tools/shared/horizontal-reader.js';
import {createMenuIcon} from './tools/shared/icons.js';
import {readPreferences,savePreferences} from './tools/shared/preferences.js';
import {bindAutoRun} from './tools/shared/auto-run.js';
import {isIncompleteNumber} from './tools/shared/numeric-edit.js';
import Choices from 'choices.js';
import 'choices.js/public/assets/styles/choices.min.css';
import {registerContentCheck} from './tools/shared/content-state.js';
import { initTool, $, showError, clearStatus, setStatus, submitForm } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, language, onLanguageChange, translateDOM } from './i18n.js';
import { categories, units, findUnits, convertUnits } from './tools/units/core.js';
import './tools/calculator/style.css';
initTool('units',`<section class="tool-card"><div class="tool-fields"><div class="field"><label for="unit-category" data-i18n="units.category"></label><select id="unit-category">${categories.map(category=>`<option value="${category}" data-i18n="units.${category}"></option>`).join('')}</select></div><div class="field"><label for="unit-search" data-i18n="units.search"></label><input id="unit-search" type="search" autocomplete="off"></div><div class="field"><label for="unit-value" data-i18n="units.value"></label><input id="unit-value" value="1" inputmode="decimal" dir="ltr"></div></div><div class="tool-fields"><div class="field"><label for="unit-from" data-i18n="units.from"></label><select id="unit-from" dir="ltr"></select></div><div class="field"><label for="unit-to" data-i18n="units.to"></label><select id="unit-to" dir="ltr"></select></div></div><div class="tool-actions"><button id="unit-run" class="primary" data-i18n="units.convert"></button><button id="unit-swap" data-i18n="units.swap"></button><label class="check-label"><input id="unit-all" type="checkbox"><span data-i18n="units.allTargets"></span></label></div><p id="unit-empty" class="tool-note" data-i18n="units.noMatches" hidden></p><p class="tool-note" data-i18n="units.precision"></p></section><section class="tool-card"><h2 data-i18n="units.result"></h2><div id="unit-primary" class="unit-primary" dir="ltr" aria-live="polite"></div><div id="unit-results"></div><div class="tool-actions"><button id="unit-copy" data-i18n="units.copy" disabled></button></div></section><section class="tool-card"><h2 data-i18n="units.other"></h2><a href="./convert.html" data-i18n="units.otherLink"></a></section>`);
const savedCategory=readPreferences().options.unitCategory;if(categories.includes(savedCategory))$('unit-category').value=savedCategory;
let result,primaryView;const unitPickers=new Map();
function populate(){
  const source=$('unit-from').value,target=$('unit-to').value,category=$('unit-category').value;
  const matches=findUnits($('unit-search').value,category),all=units.filter(unit=>unit.category===category);
  $('unit-empty').hidden=matches.length>0;
  for(const [id,previous,fallback] of [['unit-from',source,all[0]?.id],['unit-to',target,all[1]?.id]]){
    const options=id==='unit-to'?[...all]:[...matches];const selected=all.find(unit=>unit.id===previous)||all.find(unit=>unit.id===fallback);if(selected&&!options.includes(selected))options.unshift(selected);
    const entries=options.map(unit=>({value:unit.id,label:unitName(unit.id),selected:unit.id===(options.some(u=>u.id===previous)?previous:selected?.id),customProperties:{search:unit.aliases}}));
    if(unitPickers.has(id))unitPickers.get(id).setChoices(entries,'value','label',true,true,true);
    else $(id).replaceChildren(...entries.map(entry=>{const option=document.createElement('option');option.value=entry.value;option.textContent=entry.label;option.selected=entry.selected;return option;}));
  }
}
const intlUnits={m:'meter',km:'kilometer',cm:'centimeter',mm:'millimeter',inch:'inch',ft:'foot',yd:'yard',mile:'mile',L:'liter',mL:'milliliter',gallon:'gallon',floz:'fluid-ounce',kg:'kilogram',g:'gram',mg:'milligram',tonne:'metric-ton',lb:'pound',oz:'ounce',degC:'celsius',degF:'fahrenheit','m/s':'meter-per-second','km/h':'kilometer-per-hour','mile/h':'mile-per-hour',hectare:'hectare',acre:'acre'};
function unitName(id){
 const symbol={m2:'m²',km2:'km²',cm2:'cm²',ft2:'ft²',m3:'m³',cm3:'cm³',degC:'°C',degF:'°F'}[id]||id;
 const localized=t('unitNames.'+id,{defaultValue:''});if(localized){const name=`${localized} (${symbol})`;return ['gallon','floz'].includes(id)?t('ux.usUnit',{unit:name}):name;}
 try{if(intlUnits[id]){const parts=new Intl.NumberFormat(language(),{style:'unit',unit:intlUnits[id],unitDisplay:'long'}).formatToParts(2);const name=`${parts.filter(part=>part.type==='unit').map(part=>part.value).join('')} (${symbol})`;return ['gallon','floz'].includes(id)?t('ux.usUnit',{unit:name}):name;}}catch{}
 const aliases=units.find(unit=>unit.id===id)?.aliases||id;
 const name=language().startsWith('zh')?aliases.match(/[\u3400-\u9fff]+/)?.[0]:aliases.split(/[\u3400-\u9fff]/)[0].trim();
 return `${name||id} (${symbol})`;
}
function displayEquation(){if(!result)return '';const primary=result.results.find(item=>item.unit===$('unit-to').value);return `${result.input} ${unitName(result.from)} = ${primary.approximate?'≈ ':''}${primary.display} ${unitName(primary.unit)}`;}
function renderPrimary(){
 if(!primaryView){
  const host=$('unit-primary'),create=(tag,className)=>{const node=document.createElement(tag);node.className=className;return node;};
  const sourceRow=create('div','unit-primary-row'),targetRow=create('div','unit-primary-row'),sourceLabel=create('span','unit-value-label'),targetLabel=create('span','unit-value-label'),source=create('span','unit-source-value'),target=create('span','unit-target-value'),announcement=create('span','unit-equation-status');
  source.id='unit-source-value';target.id='unit-target-value';sourceLabel.id=source.id+'-label';targetLabel.id=target.id+'-label';for(const value of [source,target]){value.setAttribute('role','region');value.setAttribute('aria-labelledby',value.id+'-label');}
  sourceRow.setAttribute('aria-live','off');targetRow.setAttribute('aria-live','off');sourceRow.append(sourceLabel,source);targetRow.append(targetLabel,target);host.append(sourceRow,targetRow,announcement);
  primaryView={source,target,sourceLabel,targetLabel,announcement,readers:[mountHorizontalReader(source,{label:()=>t('units.from')}),mountHorizontalReader(target,{label:()=>t('units.to')})]};
 }
 const view=primaryView;view.sourceLabel.textContent=result?`${t('units.from')} · ${unitName(result.from)}`:'';const primary=result?.results.find(item=>item.unit===$('unit-to').value);view.targetLabel.textContent=primary?`${t('units.to')} · ${unitName(primary.unit)}`:'';
 for(const [node,value]of [[view.source,result?.input||''],[view.target,primary?`${primary.approximate?'≈ ':''}${primary.display}`:''],[view.announcement,displayEquation()]])if(node.textContent!==value)node.textContent=value;
 for(const reader of view.readers)reader.refresh();$('unit-primary').hidden=!result;
}
function render(){
  const otherCount=result?.results.filter(item=>item.unit!==$('unit-to').value).length||0;const summary=$('unit-more-results')?.querySelector('summary');if(summary)summary.textContent=t('usabilityDaily.unitOtherCount',{count:otherCount});
  if($('unit-more-results'))$('unit-more-results').hidden=!otherCount;
  $('unit-copy').disabled=!result;for(const id of ['unit-copy-equation','unit-copy-all'])if($(id))$(id).disabled=!result;if($('unit-copy-all'))$('unit-copy-all').hidden=!$('unit-all').checked;$('unit-results').replaceChildren();renderPrimary();if(!result)return;
  const primary=result.results.find(item=>item.unit===$('unit-to').value);

  for(const item of result.results.filter(item=>item.unit!==$('unit-to').value)){const row=document.createElement('div');row.className='numeric-result-row';const unit=document.createElement('span'),output=document.createElement('output'),button=document.createElement('button');unit.textContent=unitName(item.unit);unit.dir=output.dir='ltr';output.textContent=`${item.approximate?'≈ ':''}${item.display}`;output.setAttribute('aria-live','off');button.textContent=t('units.copyOne');button.setAttribute('aria-label',`${t('units.copyOne')} · ${item.unit}`);button.addEventListener('click',()=>copyText(item.value));row.append(unit,output,button);$('unit-results').append(row);}
}
function invalidate(){const had=Boolean(result);result=undefined;clearStatus({keepStale:true});render();if(had)setStatus('ux.stale');}
function run(explicit=false){clearStatus();try{result=convertUnits($('unit-value').value,$('unit-from').value,$('unit-all').checked?[$('unit-to').value,...units.filter(unit=>unit.category===$('unit-category').value&&unit.id!==$('unit-to').value).map(unit=>unit.id)]:[$('unit-to').value]);}catch(error){result=undefined;showError(error,{field:'unit-value',focus:explicit===true});}render();}
$('unit-category').addEventListener('change',()=>{const prefs=readPreferences();savePreferences({...prefs,options:{...prefs.options,unitCategory:$('unit-category').value}});$('unit-search').value='';populate();invalidate();});$('unit-search').addEventListener('input',populate);for(const id of ['unit-value','unit-from','unit-to'])$(id).addEventListener('input',invalidate);$('unit-all').addEventListener('input',()=>run(false));
$('unit-run').addEventListener('click',()=>run(true));$('unit-swap').addEventListener('click',()=>{const source=$('unit-from').value,target=$('unit-to').value;$('unit-search').value='';populate();unitPickers.get('unit-from').setChoiceByValue(target);unitPickers.get('unit-to').setChoiceByValue(source);invalidate();run(true);});$('unit-copy').addEventListener('click',()=>{if(result)copyText(result.results.find(item=>item.unit===$('unit-to').value).value);});onLanguageChange(()=>{populate();render();});populate();run();

let unitsEngaged=false;document.querySelector('#tool-root').addEventListener('input',()=>{unitsEngaged=true;});document.querySelector('#unit-run').addEventListener('click',()=>{unitsEngaged=true;});

registerContentCheck(()=>Boolean($('unit-value').value&&($('unit-value').value!=='1'||unitsEngaged)));

$('unit-from').closest('.field').after($('unit-swap'));$('unit-from').closest('.tool-fields').classList.add('unit-direction');

$('unit-search').closest('.field').hidden=true;
for(const id of ['unit-from','unit-to']){
 const field=$(id).closest('.field'),label=field.querySelector('label');label.id=id+'-label';field.classList.add('unit-picker');
 const picker=new Choices($(id),{allowHTML:false,shouldSort:false,itemSelectText:'',labelId:label.id,searchFields:['label','value','customProperties.search'],searchResultLimit:100,fuseOptions:{threshold:.1,ignoreLocation:true},noResultsText:()=>t('units.noMatches'),noChoicesText:()=>t('units.noMatches')});unitPickers.set(id,picker);
 $(id).addEventListener('change',invalidate);picker.input.element.setAttribute('aria-label',t('units.search'));picker.input.element.placeholder=t('units.search');onLanguageChange(()=>{picker.input.element.setAttribute('aria-label',t('units.search'));picker.input.element.placeholder=t('units.search');});$(id).addEventListener('hideDropdown',()=>picker.clearInput());
}
populate();
const unitInput=$('unit-value').closest('.field');$('unit-from').closest('.field').before(unitInput);
const unitResultCard=$('unit-primary').closest('section');$('unit-from').closest('section').append(unitResultCard);unitResultCard.classList.add('unit-inline-result');
submitForm($('unit-from').closest('section'),$('unit-run'));

$('unit-copy').dataset.i18n='units.copyOne';
for(const [id,key] of [['unit-copy-equation','copyEquation'],['unit-copy-all','copyAllConversions']]){const button=document.createElement('button');button.id=id;button.type='button';button.dataset.i18n=id==='unit-copy-equation'?'redesign.copyDisplayedEquation':'refinement.'+key;$('unit-copy').parentElement.append(button);button.onclick=()=>{if(result)copyText(id==='unit-copy-equation'?displayEquation():result.results.map(item=>`${item.value} ${item.unit}`).join('\n'));};}
translateDOM($('unit-copy').parentElement);render();

const unitDetails=document.createElement('details');unitDetails.id='unit-more-results';unitDetails.innerHTML='<summary></summary>';
const unitPrecision=document.querySelector('[data-i18n="units.precision"]');unitPrecision.dataset.i18n='direct.daily.unitPrecision';
unitDetails.append($('unit-results'));unitResultCard.append(unitDetails,unitPrecision);translateDOM(unitResultCard);render();

const unitAutoRun=bindAutoRun($('unit-value').closest('section'),()=>run(false),{button:$('unit-run'),canRun:()=>Boolean($('unit-value').value.trim())&&!isIncompleteNumber($('unit-value').value)&&Boolean($('unit-from').value&&$('unit-to').value)});
$('unit-value').addEventListener('blur',event=>{unitAutoRun.cancel();if(![$('unit-run'),$('unit-swap')].some(button=>button===event.relatedTarget||button.matches(':active')))run(false);});
$('unit-all').closest('section').addEventListener('change',event=>{if(event.target===$('unit-all'))unitAutoRun.cancel();});

const swap=$('unit-swap');delete swap.dataset.i18n;swap.replaceChildren(createMenuIcon('arrow-right-left'));function swapLabel(){swap.setAttribute('aria-label',t('units.swap'));swap.title=t('units.swap');}onLanguageChange(swapLabel);swapLabel();

const precisionDetails=document.createElement('details');precisionDetails.id='unit-precision-details';precisionDetails.innerHTML='<summary data-i18n="experience.unitPrecision"></summary>';unitPrecision.before(precisionDetails);precisionDetails.append(unitPrecision);translateDOM(precisionDetails);
