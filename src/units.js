import {registerContentCheck} from './tools/shared/content-state.js';
import { initTool, $, showError, clearStatus } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, language, onLanguageChange } from './i18n.js';
import { categories, units, findUnits, convertUnits } from './tools/units/core.js';
import './tools/calculator/style.css';
initTool('units',`<section class="tool-card"><div class="tool-fields"><div class="field"><label for="unit-category" data-i18n="units.category"></label><select id="unit-category">${categories.map(category=>`<option value="${category}" data-i18n="units.${category}"></option>`).join('')}</select></div><div class="field"><label for="unit-search" data-i18n="units.search"></label><input id="unit-search" type="search" autocomplete="off"></div><div class="field"><label for="unit-value" data-i18n="units.value"></label><input id="unit-value" value="1" inputmode="decimal" dir="ltr"></div></div><div class="tool-fields"><div class="field"><label for="unit-from" data-i18n="units.from"></label><select id="unit-from" dir="ltr"></select></div><div class="field"><label for="unit-to" data-i18n="units.to"></label><select id="unit-to" dir="ltr"></select></div></div><div class="tool-actions"><button id="unit-run" class="primary" data-i18n="units.convert"></button><button id="unit-swap" data-i18n="units.swap"></button><label class="check-label"><input id="unit-all" type="checkbox"><span data-i18n="units.allTargets"></span></label></div><p id="unit-empty" class="tool-note" data-i18n="units.noMatches" hidden></p><p class="tool-note" data-i18n="units.precision"></p></section><section class="tool-card"><h2 data-i18n="units.result"></h2><p id="unit-primary" class="unit-primary" dir="ltr"></p><div id="unit-results" aria-live="polite"></div><div class="tool-actions"><button id="unit-copy" data-i18n="units.copy" disabled></button></div></section><section class="tool-card"><h2 data-i18n="units.other"></h2><a href="./convert.html" data-i18n="units.otherLink"></a></section>`);
let result;
function populate(){
  const source=$('unit-from').value,target=$('unit-to').value,category=$('unit-category').value;
  const matches=findUnits($('unit-search').value,category),all=units.filter(unit=>unit.category===category);
  $('unit-empty').hidden=matches.length>0;
  for(const [id,previous,fallback] of [['unit-from',source,all[0]?.id],['unit-to',target,all[1]?.id]]){
    const options=id==='unit-to'?[...all]:[...matches];const selected=all.find(unit=>unit.id===previous)||all.find(unit=>unit.id===fallback);if(selected&&!options.includes(selected))options.unshift(selected);
    $(id).replaceChildren(...options.map(unit=>{const option=document.createElement('option');option.value=unit.id;option.textContent=unitName(unit.id);return option;}));
    if(options.some(unit=>unit.id===previous))$(id).value=previous;else if(selected)$(id).value=selected.id;
  }
}
const intlUnits={m:'meter',km:'kilometer',cm:'centimeter',mm:'millimeter',inch:'inch',ft:'foot',yd:'yard',mile:'mile',L:'liter',mL:'milliliter',gallon:'gallon',floz:'fluid-ounce',kg:'kilogram',g:'gram',mg:'milligram',tonne:'metric-ton',lb:'pound',oz:'ounce',degC:'celsius',degF:'fahrenheit','m/s':'meter-per-second','km/h':'kilometer-per-hour','mile/h':'mile-per-hour',hectare:'hectare',acre:'acre'};
function unitName(id){
 const symbol={m2:'m²',km2:'km²',cm2:'cm²',ft2:'ft²',m3:'m³',cm3:'cm³',degC:'°C',degF:'°F'}[id]||id;
 try{if(intlUnits[id]){const parts=new Intl.NumberFormat(language(),{style:'unit',unit:intlUnits[id],unitDisplay:'long'}).formatToParts(2);return `${parts.filter(part=>part.type==='unit').map(part=>part.value).join('')} (${symbol})`;}}catch{}
 const aliases=units.find(unit=>unit.id===id)?.aliases||id;
 const name=language().startsWith('zh')?aliases.match(/[\u3400-\u9fff]+/)?.[0]:aliases.split(/[\u3400-\u9fff]/)[0].trim();
 return `${name||id} (${symbol})`;
}
function render(){
  $('unit-copy').disabled=!result;$('unit-results').replaceChildren();$('unit-primary').textContent='';if(!result)return;
  const primary=result.results.find(item=>item.unit===$('unit-to').value);
  $('unit-primary').textContent=`${result.input} ${unitName(result.from)} = ${primary.approximate?'≈ ':''}${primary.display} ${unitName(primary.unit)}`;
  for(const item of result.results.filter(item=>item.unit!==$('unit-to').value)){const row=document.createElement('div');row.className='numeric-result-row';const unit=document.createElement('span'),output=document.createElement('output'),button=document.createElement('button');unit.textContent=unitName(item.unit);unit.dir=output.dir='ltr';output.textContent=`${item.approximate?'≈ ':''}${item.display}`;button.textContent=t('units.copyOne');button.setAttribute('aria-label',`${t('units.copyOne')} · ${item.unit}`);button.addEventListener('click',()=>copyText(item.value));row.append(unit,output,button);$('unit-results').append(row);}
}
function invalidate(){result=undefined;clearStatus();render();}
function run(){clearStatus();try{result=convertUnits($('unit-value').value,$('unit-from').value,$('unit-all').checked?[$('unit-to').value,...units.filter(unit=>unit.category===$('unit-category').value&&unit.id!==$('unit-to').value).map(unit=>unit.id)]:[$('unit-to').value]);}catch(error){result=undefined;showError(error);}render();}
$('unit-category').addEventListener('change',()=>{$('unit-search').value='';populate();invalidate();});$('unit-search').addEventListener('input',populate);for(const id of ['unit-value','unit-from','unit-to','unit-all'])$(id).addEventListener('input',invalidate);
$('unit-run').addEventListener('click',run);$('unit-value').addEventListener('keydown',event=>{if(event.key==='Enter')run();});$('unit-swap').addEventListener('click',()=>{const source=$('unit-from').value,target=$('unit-to').value;$('unit-search').value='';populate();$('unit-from').value=target;$('unit-to').value=source;invalidate();run();});$('unit-copy').addEventListener('click',()=>{if(result)copyText(result.results.map(item=>`${item.value} ${item.unit}`).join('\n'));});onLanguageChange(()=>{populate();render();});populate();run();

let unitsEngaged=false;document.querySelector('#tool-root').addEventListener('input',()=>{unitsEngaged=true;});document.querySelector('#unit-run').addEventListener('click',()=>{unitsEngaged=true;});

registerContentCheck(()=>Boolean($('unit-value').value&&($('unit-value').value!=='1'||unitsEngaged)));
