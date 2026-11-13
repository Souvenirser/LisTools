import {initTool,clearStatus,showError,setStatus} from './tools/shared/office.js';
import {t,onLanguageChange,translateDOM} from './i18n.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import {actionArea} from './tools/shared/workspace.js';
import {calculateContributions} from './tools/payroll/contributions.js';
import {calculateWage} from './tools/payroll/tax.js';
import {mountDeductionAssistant} from './tools/payroll/deduction-assistant.js';
import {resolveEstimatePolicy as resolvePolicy,cities,policyVersion} from './tools/payroll/policy.js';
import {copyText} from './tools/shared/page.js';
import {D,amount,fail,percent,monthParts} from './tools/payroll/money.js';
import {$,field,select,check,note,value,cityMarkup,mountCity,deductions,mountDeductions,basicDeductionSettings,resultsView,renderRows,attachExports,setReady,mountBasicDeduction,financialDraft,formatMoney} from './tools/payroll/ui.js';

document.body.classList.add('payroll-page');
const ids=['pension','medical','unemployment','maternity','injury','housing'];
const details=(id,key,body)=>`<details id="${id}"><summary data-i18n="${key}"></summary>${body}</details>`;
const currentMonth=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
initTool('insurance',`<div class="payroll-workspace insurance-workspace"><section class="tool-card" id="insurance-input">
<div class="payroll-period-row">${field('insurance-month','payroll.month',currentMonth,'month','min="2026-01" max="9999-12"')}</div>
<div class="payroll-fields insurance-primary">${cityMarkup('insurance')}${field('insurance-salary','payroll128.salary')}<div class="field"><label for="insurance-housing-choice" data-i18n="payroll128.housingRate"></label><select id="insurance-housing-choice">${Array.from({length:8},(_,i)=>`<option value="${i+5}" ${i===2?'selected':''}>${i+5}%</option>`).join('')}<option value="custom" data-i18n="payroll128.customRate"></option><option value="none" data-i18n="payroll128.noHousing"></option></select></div></div>
${field('insurance-housing-employee','payroll128.customHousing')}<p id="insurance-city-notice" class="tool-note" role="status" hidden></p><p id="insurance-base-hint" class="tool-note"></p><div hidden>${check('insurance-active-housing','insuranceEase.includeHousing',true)}</div>
<div id="insurance-profile" hidden>${select('insurance-tier','payroll.medicalTier',[['0','payroll.tier1'],['1','payroll.tier2']],'0')}${check('insurance-hukou','payroll.hukou')}</div>
<div class="tool-actions" id="insurance-actions"><button type="button" id="insurance-run" class="primary" data-i18n="payroll128.runInsurance"></button></div>
${details('insurance-bases','insuranceEase.actualBases',`${select('insurance-mode','payroll.baseMode',[['estimate','payroll.estimate'],['actual','payroll.actualBase']],'estimate')}<div class="payroll-fields">${field('insurance-base','insuranceEase.socialBase')}${field('insurance-base-housing','insuranceEase.housingBase')}</div>${note('insuranceEase.baseOverrides')}`)}
${details('insurance-settings','insuranceEase.moreSettings',`${check('insurance-linked','payroll.linkRates',true)}<p id="insurance-linked-summary" class="tool-note"></p><p id="insurance-housing-hint" class="tool-note"></p>${field('insurance-housing-employer','payroll.housingEmployer')}<div class="payroll-item-settings">${ids.map(id=>`<section class="payroll-item-setting" data-item="${id}"><h3 data-i18n="payroll.item_${id}"></h3>${id==='housing'?'':check('insurance-active-'+id,'payroll.participate',true)+`<div class="payroll-fields">${field('insurance-base-'+id,'payroll.base')}${field('insurance-employee-'+id,'payroll.employeeRate')}${field('insurance-employer-'+id,'payroll.employerRate')}${field('insurance-fixed-'+id,'payroll.fixed','0')}${field('insurance-fixed-employer-'+id,'payroll.fixedEmployer','0')}</div>`}<p class="tool-note" id="insurance-policy-${id}"></p></section>`).join('')}</div>${note('payroll.injuryHint')}${check('insurance-supplemental-active','payroll.item_supplemental')}<div class="payroll-fields">${field('insurance-supplemental-employee','payroll.employee','0')}${field('insurance-supplemental-employer','payroll.employer','0')}</div>`)}
${details('insurance-tax-settings','insuranceEase.takeHome',`${check('insurance-tax-enabled','payroll.includeTax')}<div id="insurance-tax-input" hidden><div class="tax-deduction-total">${deductions('insurance-tax')}<button type="button" class="tax-text-action" id="insurance-tax-help" data-i18n="taxEase.helpDeduction"></button></div>${note('taxEase.specialHint')}${note('payroll.quickHint')}<p id="insurance-tax-month-summary" class="tool-note"></p>${details('insurance-tax-employment','taxEase.employment',`${field('insurance-tax-startMonth','payroll.startMonth','1','number','min="1" max="12"')}${basicDeductionSettings('insurance-tax')}${check('insurance-tax-firstConfirmed','taxEase.firstConfirmed')}${field('insurance-tax-other','payroll.other','0')}`)}<div id="insurance-tax-custom" hidden>${field('insurance-deductible','payroll.deductible')}${field('insurance-taxableAdjustment','payroll.adjustment')}${note('payroll.adjustmentHint')}</div></div>`)}
${details('insurance-custom-options','insuranceEase.manualParameters',`${check('insurance-custom-mode','payroll.custom')}<div id="insurance-custom-fields" hidden>${field('insurance-customName','payroll.customName')}${note('insuranceEase.customWarning')}${check('insurance-confirm','payroll.confirmCustom')}${note('insuranceEase.customRates')}</div>`)}
${details('insurance-policy-details','payroll.policy','<p id="insurance-policy-availability" class="tool-note"></p><div id="insurance-policy"></div>')}
</section>${resultsView('insurance')}</div>`);
const title=document.querySelector('#tool-root h1');title.id='insurance-title';title.closest('main').setAttribute('aria-labelledby',title.id);
const getSpecial=mountDeductions('insurance-tax'),basicDeduction=mountBasicDeduction('insurance-tax');
let policy,result,rows=[],snapshot,fingerprint='',previousPolicy='',resultForm='',housingEdited=false,customHousing='';
const custom=()=>$('insurance-custom-mode').checked;
function policyStatus(p){if(p?.reference)return 'payroll128.reference';return !p||p.items.some(i=>!i.verified)?'insuranceEase.policyMissing':p.items.some(i=>!i.mergedInto&&i.employer===null)?'insuranceEase.personalOnly':'insuranceEase.bothReady';}
mountCity('insurance');
const cityControl=$('insurance-city').closest('.choices');cityControl.id='insurance-city-control';cityControl.tabIndex=0;
const assistant=mountDeductionAssistant('insurance-deduction','insurance-tax-special',()=>{$('insurance-tax-deductionMode').value='total';$('insurance-tax-deductionMode').dispatchEvent(new Event('change',{bubbles:true}));invalidate();});
$('insurance-tax-help').onclick=event=>assistant.open(event.currentTarget);

function syncHousing(){
 const linked=$('insurance-linked').checked,enabled=$('insurance-active-housing').checked;
 if(!['none','custom'].includes(value('insurance-housing-choice')))$('insurance-housing-employee').value=value('insurance-housing-choice');
 if(linked)$('insurance-housing-employer').value=value('insurance-housing-employee');
 $('insurance-housing-employer').readOnly=linked;
 $('insurance-housing-employee').closest('.field').hidden=value('insurance-housing-choice')!=='custom';
 $('insurance-housing-employee').disabled=!enabled;$('insurance-housing-employer').disabled=!enabled;
 $('insurance-linked-summary').hidden=!enabled||!value('insurance-housing-employer');
 $('insurance-linked-summary').textContent=t(linked?'insuranceEase.linkedSummary':'insuranceEase.separateSummary',{rate:value('insurance-housing-employer')||'—'});
}
function refreshPolicy(){
 policy=undefined;try{if(value('insurance-city'))policy=resolvePolicy(value('insurance-city'),value('insurance-month'),{tier:value('insurance-tier'),hukou:$('insurance-hukou').checked});}catch{/* Explicit calculation reports missing policy or month. */}
 $('insurance-city-notice').hidden=custom()||!policy?.reference;$('insurance-city-notice').textContent=t('payroll128.referenceHint');
 $('insurance-policy-availability').textContent=[value('insurance-month'),custom()?t('insuranceEase.customWarning'):!value('insurance-city')?t('payroll.chooseCity'):t(policyStatus(policy))].join(' · ');
 $('insurance-base-hint').textContent=t(value('insurance-mode')==='actual'?'insuranceEase.actualHint':'payroll.baseHint');
 const city=cities.find(c=>c.id===value('insurance-city'));$('insurance-profile').hidden=custom()||policy?.reference||!city?.needsHukou;
 const signature=JSON.stringify([policy?.cityId,policy?.month,value('insurance-tier'),$('insurance-hukou').checked,policy?.items]),changed=signature!==previousPolicy;
 if(!custom()){
  for(const id of ids.filter(id=>id!=='housing')){const r=policy?.items.find(i=>i.id===id);$('insurance-employee-'+id).value=(r?.verified||r?.reference)?new D(r.employee).mul(100).toString():'';if(id!=='injury'||changed)$('insurance-employer-'+id).value=(r?.verified||r?.reference)&&r.employer!==null?new D(r.employer).mul(100).toString():'';$('insurance-fixed-'+id).value=r?.employeeFixed||'0';$('insurance-fixed-employer-'+id).value=r?.employerFixed||'0';}
  const housing=policy?.items.find(i=>i.id==='housing');if(!housingEdited&&(housing?.verified||housing?.reference)){const max=new D(housing.rateMax??housing.employee).mul(100),defaultRate=max.toString();$('insurance-housing-employee').value=defaultRate;$('insurance-housing-choice').value=Number.isInteger(Number(defaultRate))&&Number(defaultRate)>=5&&Number(defaultRate)<=12?defaultRate:'custom';}
  previousPolicy=signature;
 }
 const housing=policy?.items.find(i=>i.id==='housing');$('insurance-housing-hint').textContent=t(custom()?'insuranceEase.customRates':(housing?.verified||housing?.reference)?'insuranceEase.housingTrial':'insuranceEase.housingNoDefault');
 for(const id of ids){const r=policy?.items.find(i=>i.id===id),p=$('insurance-policy-'+id),range=r&&!r.verified&&r.min==null&&r.max==null?t('payroll.unknown'):`${r?.min??'0'}—${r?.max??'∞'}`;p.textContent=custom()?t('insuranceEase.customWarning'):r?(r.reference?`${t('payroll128.reference')} · ${range} · ${policy.referenceAsOf}`:`${t(r.verified?'payroll.verified':'payroll.pending')} · ${range} · ${r.from}—${r.to} · ${r.verifiedAt||t('payroll.unknown')}`):t('payroll.missing');if(!custom()&&r?.mergedInto)p.textContent=t('payroll.merged');$('insurance-base-'+id).closest('.field').hidden=value('insurance-mode')!=='actual';}
 for(const id of ids.filter(id=>id!=='housing')){for(const side of ['employee','employer'])$('insurance-'+side+'-'+id).readOnly=!custom()&&!(id==='injury'&&side==='employer');for(const k of ['fixed-','fixed-employer-'])$('insurance-'+k+id).readOnly=!custom();}
 $('insurance-base').closest('.field').hidden=value('insurance-mode')!=='actual';$('insurance-custom-fields').hidden=!custom();
 $('insurance-tax-custom').hidden=!custom();$('insurance-tax-input').hidden=!$('insurance-tax-enabled').checked;
 $('insurance-tax-firstConfirmed').closest('label').hidden=value('insurance-tax-basicDeductionMode')!=='first-employment';
 $('insurance-tax-month-summary').textContent=t('insuranceEase.taxMonth',{month:value('insurance-month')});syncHousing();
 const target=$('insurance-policy');target.replaceChildren();const p=document.createElement('p');p.className='tool-note';p.textContent=t(custom()?'insuranceEase.customWarning':policyStatus(policy));target.append(p);
 if(!custom())for(const source of policy?.sources||[]){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title;const row=document.createElement('p');row.append(a);target.append(row);}
 const version=document.createElement('p');version.className='tool-note';version.textContent=t('payroll.dataVersion')+' · '+(policy?.version||policyVersion);target.append(version);
}
function read(){
 monthParts(value('insurance-month'));
 if(!custom()&&!policy)resolvePolicy(value('insurance-city'),value('insurance-month'));
 if(custom()&&!$('insurance-confirm').checked)fail('insurance.confirm','insurance-confirm');
 let p=policy;
 if(custom())p={cityId:value('insurance-city')||'custom',cityName:value('insurance-customName'),month:value('insurance-month'),version:policyVersion,custom:true,sources:[],items:ids.map(id=>({id,min:null,max:null,employee:'0',employer:'0',employeeFixed:'0',employerFixed:'0',digits:id==='housing'?0:2,rounding:'half-up',verified:true}))};
 if(!p)fail('insurance.choose','insurance-city-control');
 const data={salary:value('insurance-salary'),mode:value('insurance-mode'),base:value('insurance-base'),bases:Object.fromEntries(ids.filter(id=>value('insurance-base-'+id)).map(id=>[id,value('insurance-base-'+id)])),rates:{},excluded:ids.filter(id=>!$('insurance-active-'+id).checked)};
 for(const id of ids){if(data.excluded.includes(id)||p.items.find(i=>i.id===id)?.mergedInto)continue;
  if(!custom()&&!p.items.find(i=>i.id===id)?.verified&&!p.items.find(i=>i.id===id)?.reference)fail('insurance.unverified','insurance-city-control',{item:id});
  if(id==='housing'){data.rates[id]={employee:percent(value('insurance-housing-employee'),'insurance-housing-employee'),employer:!$('insurance-linked').checked&&value('insurance-housing-employer')===''?null:percent(value($('insurance-linked').checked?'insurance-housing-employee':'insurance-housing-employer'),'insurance-housing-employer')};continue;}
  data.rates[id]={employee:percent(value('insurance-employee-'+id),'insurance-employee-'+id),employer:value('insurance-employer-'+id)===''?null:percent(value('insurance-employer-'+id),'insurance-employer-'+id)};
  if(custom())Object.assign(p.items.find(i=>i.id===id),{employeeFixed:amount(value('insurance-fixed-'+id),'insurance-fixed-'+id,0).toFixed(2),employerFixed:amount(value('insurance-fixed-employer-'+id),'insurance-fixed-employer-'+id,0).toFixed(2)});
 }
 if($('insurance-supplemental-active').checked){if(data.bases.housing!==undefined)data.bases.supplemental=data.bases.housing;const housing=p.items.find(i=>i.id==='housing');p={...p,reference:!custom(),items:[...p.items,{...housing,id:'supplemental',reference:!custom(),employee:percent(value('insurance-supplemental-employee'),'insurance-supplemental-employee'),employer:percent(value('insurance-supplemental-employer'),'insurance-supplemental-employer'),rateMin:undefined,rateMax:undefined,rateStep:!custom()&&p.cityId==='shanghai'?'0.01':undefined,verified:false}]};if(!custom()&&p.cityId==='shanghai')for(const side of ['employee','employer']){const r=new D(p.items.at(-1)[side]);if(r.lt(.01)||r.gt(.05))fail('insurance.rateRange','insurance-supplemental-'+side);}}
 // Contribution calculation never reads optional tax drafts. Tax failures are partial success.
 return {data,policy:p,taxDraft:$('insurance-tax-enabled').checked?financialDraft($('insurance-tax-input')):null};
}
function attachTax(next,input){
 const period=monthParts(value('insurance-month')),mode=basicDeduction.read();
 if(mode.basicDeductionMode==='first-employment'&&!$('insurance-tax-firstConfirmed').checked)fail('tax.easeFirstConfirmation','insurance-tax-firstConfirmed');
 if(custom()){
  const deductible=amount(value('insurance-deductible'),'insurance-deductible');if(deductible.gt(next.employeeTotal))fail('insurance.deductibleRange','insurance-deductible');
  next.taxDeductible=deductible.toFixed(2);next.taxableAdjustment=amount(value('insurance-taxableAdjustment'),'insurance-taxableAdjustment').toFixed(2);
 }
 next.tax=calculateWage({...period,startMonth:value('insurance-tax-startMonth'),...mode,specialDeduction:getSpecial(),otherDeduction:value('insurance-tax-other'),salary:input.data.salary,contributions:next.employeeTotal,deductibleContributions:next.taxDeductible,taxableAdjustment:next.taxableAdjustment});
}
function allRows(){if(!result)return [];return [['employeeTotal','payroll128.personal',result.employeeTotal,true],['employerTotal','payroll128.employer',result.employerTotal??t('payroll.unknown')],['employeeSocial','payroll.socialTotal',result.employeeSocial],['employeeHousing','payroll.housingTotal',result.employeeHousing],['cashBeforeTax','insuranceEase.remaining',result.cashBeforeTax],['housingCredit','payroll.housingCredit',result.housingCredit??t('payroll.unknown')],['companyCost','payroll.companyCost',result.companyCost??t('payroll.unknown')],...(result.tax?[['currentTax','payroll.currentTax',result.tax.currentTax],['net','payroll.net',result.tax.net,true]]:[])];}
function render(){
 rows=allRows();renderRows('insurance',rows);setReady('insurance',!!result);if(!result)return;
 const root=$('insurance-values'),dl=root.firstElementChild;dl.classList.add('payroll-summary-grid');
 const footer=document.createElement('dl');footer.id='insurance-company';footer.className='payroll-values insurance-subtotals';
 for(const out of dl.querySelectorAll('output')){const raw=rows.find(row=>row[0]===out.dataset.value)?.[2];if(/^-?\d+(?:\.\d+)?$/.test(raw))out.textContent=formatMoney(raw);if(['employeeSocial','employeeHousing','companyCost'].includes(out.dataset.value))footer.append(out.closest('.payroll-value'));else out.closest('.payroll-value').querySelector('button').hidden=true;}
 const condition=document.createElement('p');condition.className='payroll-result-context';condition.id='insurance-condition';condition.textContent=[snapshot.cityName||t('payroll.custom'),snapshot.month,snapshot.custom?t('insuranceEase.customWarning'):snapshot.reference?t('payroll128.reference'):value('insurance-mode')==='actual'?t('payroll.actualBase'):t('payroll128.estimateBase')].join(' · ');root.prepend(condition);
 const detail=document.createElement('section');detail.id='insurance-result-details';const table=document.createElement('table');table.className='payroll-table';
 const head=document.createElement('thead'),tr=document.createElement('tr');for(const key of ['payroll128.item','payroll.base','payroll.employee','payroll.employer']){const th=document.createElement('th');th.textContent=t(key);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');
 for(const item of result.items){const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=t('payroll.item_'+item.id);const status=item.excluded?t('insuranceEase.excluded'):item.mergedInto?t('payroll.merged'):item.estimated?t('insuranceEase.industryEstimate'):'';if(status){const small=document.createElement('small');small.textContent=status;name.append(small);}tr.append(name);const base=document.createElement('td');base.textContent=formatMoney(item.base);base.dir='ltr';tr.append(base);
  for(const side of ['employee','employer']){const td=document.createElement('td'),n=item[side+'Amount'],r=item[side+'Rate'];td.dir='ltr';td.textContent=n===null?t('payroll.unknown'):formatMoney(n);if(r!==null){const rate=document.createElement('small');rate.textContent=new D(r).mul(100).toString()+'%';td.append(rate);}tr.append(td);}body.append(tr);
 }table.append(body);const foot=document.createElement('tfoot'),total=document.createElement('tr');for(const text of [t('payroll128.total'),'—',formatMoney(result.employeeTotal),result.employerTotal===null?t('payroll.unknown'):formatMoney(result.employerTotal)]){const td=document.createElement('td');td.textContent=text;total.append(td);}foot.append(total);table.append(foot);const scroll=document.createElement('div');scroll.className='payroll-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',t('payroll.details'));scroll.append(table);detail.append(scroll);root.append(detail,footer);
 const notes=[];if(result.taxError)notes.push(['insurance-partial','payroll.partialTax']);notes.push(['insurance-cash-note','payroll128.housingCashHint']);if(new D(result.cashBeforeTax).lt(0))notes.push(['insurance-negative','insuranceEase.negativeCash']);
 const unknown=result.items.filter(i=>i.employerAmount===null);if(unknown.length){const p=document.createElement('p');p.id='insurance-unknown-company';p.className='tool-note';p.textContent=t('insuranceEase.unitUnknown',{items:unknown.map(i=>t('payroll.item_'+i.id)).join('、')});root.append(p);}
 for(const [id,key] of notes){const p=document.createElement('p');p.id=id;p.className='tool-note';p.textContent=t(key);if(id==='insurance-partial')p.setAttribute('role','status');root.append(p);}
 const individual=document.createElement('details'),title=document.createElement('summary');title.textContent=t('payroll128.copyDetails');individual.append(title);const actions=document.createElement('div');actions.className='tool-actions';for(const side of ['Employee','Employer']){const button=document.createElement('button');button.type='button';button.textContent=t('payroll.copy'+side);button.onclick=()=>copyText(result.items.map(i=>[t('payroll.item_'+i.id),i[side.toLowerCase()+'Amount']??t('payroll.unknown')].join(': ')).join('\n'));actions.append(button);}individual.append(actions);root.append(individual);
}

function invalidate(){if(result&&financialDraft($('insurance-input'))===resultForm)return;const had=!!result;result=undefined;fingerprint='';clearStatus();render();if(had)setStatus('ux.stale');}
function errorField(error){
 if(error.field==='city'||error.field==='insurance-city')return 'insurance-city-control';
 if(error.field?.startsWith('base-')){const id=error.field.slice(5);if(ids.includes(id)&&!value('insurance-base-'+id))return 'insurance-base';}
 if(error.field==='employee-housing')return value('insurance-housing-choice')==='custom'?'insurance-housing-employee':'insurance-housing-choice';if(error.field==='employer-housing')return 'insurance-housing-employer';
 if(error.field==='employee-supplemental')return 'insurance-supplemental-employee';if(error.field==='employer-supplemental')return 'insurance-supplemental-employer';
 return $(error.field)?error.field:$('insurance-'+error.field)?'insurance-'+error.field:error.field==='specialDeduction'?'insurance-tax-special':error.field==='otherDeduction'?'insurance-tax-other':$('insurance-tax-'+error.field)?'insurance-tax-'+error.field:'insurance-salary';
}
function run(){try{const input=read(),key=JSON.stringify(input);if(result&&key===fingerprint)return;clearStatus();const next=calculateContributions(input.data,input.policy);let taxError;if(input.taxDraft!==null)try{attachTax(next,input);}catch(error){taxError=error;}result=next;fingerprint=key;resultForm=financialDraft($('insurance-input'));snapshot={...next.conditions,items:next.items,tax:input.taxDraft!==null?{...(next.tax?.conditions||{...monthParts(value('insurance-month')),startMonth:value('insurance-tax-startMonth'),...basicDeduction.read()}),status:taxError?'failed':'ready',...(taxError?{errorCode:taxError.code}:{})}:null};result.taxError=taxError;render();if(taxError)showError(taxError,{field:errorField(taxError),focus:true});}catch(error){clearStatus();showError(error,{field:errorField(error),focus:true});}}
const input=$('insurance-input');
// Mode drafts stay in this page; salary, payment month and attached tax settings are shared.
const modeFields=[...input.querySelectorAll('input[id],select[id]')].filter(node=>!['insurance-salary','insurance-month','insurance-custom-mode','insurance-city','insurance-tier','insurance-hukou'].includes(node.id)&&!node.id.startsWith('insurance-tax-'));
const capture=()=>({...Object.fromEntries(modeFields.map(node=>[node.id,node.type==='checkbox'?node.checked:node.value])),housingEdited,customHousing});
const restore=draft=>{housingEdited=draft.housingEdited;customHousing=draft.customHousing;for(const node of modeFields)if(node.id in draft){if(node.type==='checkbox')node.checked=draft[node.id];else node.value=draft[node.id];}};
let activeMode=false,paymentYear=value('insurance-month').slice(0,4);const drafts={city:capture(),custom:capture()};
$('insurance-custom-mode').addEventListener('change',()=>{drafts[activeMode?'custom':'city']=capture();activeMode=custom();restore(drafts[activeMode?'custom':'city']);invalidate();refreshPolicy();if(custom())$('insurance-settings').open=true;});
input.addEventListener('input',event=>{if(event.target.closest('.choices'))return;if(event.target.id==='insurance-housing-employee'){housingEdited=true;customHousing=event.target.value;}invalidate();if(['insurance-housing-employee','insurance-housing-employer'].includes(event.target.id))syncHousing();});
$('insurance-housing-choice').addEventListener('change',()=>{housingEdited=true;const selected=value('insurance-housing-choice');$('insurance-active-housing').checked=selected!=='none';if(selected==='custom')$('insurance-housing-employee').value=customHousing;else if(selected!=='none')$('insurance-housing-employee').value=selected;syncHousing();});
input.addEventListener('change',event=>{if(event.target.closest('.choices'))return;invalidate();refreshPolicy();});
$('insurance-city').addEventListener('change',()=>{invalidate();refreshPolicy();});
$('insurance-month').addEventListener('input',()=>{const next=value('insurance-month').slice(0,4);if(next!==paymentYear){basicDeduction.reset();$('insurance-tax-firstConfirmed').checked=false;paymentYear=next;}refreshPolicy();});
$('insurance-run').onclick=run;input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!event.target.closest('.choices')&&event.target.matches('input:not([type=checkbox])')){event.preventDefault();run();}});
attachExports('insurance',()=>rows,()=>snapshot,()=>result?.items.map(i=>({item:t('payroll.item_'+i.id),base:i.base,employeeRate:i.employeeRate,employerRate:i.employerRate,employeeFixed:i.employeeFixed,employerFixed:i.employerFixed,employeeAmount:i.employeeAmount,employerAmount:i.employerAmount,excluded:i.excluded}))||[]);
$('insurance-copyAll').dataset.i18n='insuranceEase.copySummary';actionArea($('insurance-actions'),$('tool-status'),{resultTarget:$('insurance-result'),hasResult:()=>!!result});
onLanguageChange(()=>{refreshPolicy();render();});refreshPolicy();render();translateDOM(input);translateDOM($('insurance-exports'));
const initialDraft=financialDraft(input),initialModes=JSON.stringify(drafts);registerContentCheck(()=>Boolean(result||assistant.hasDraft()||financialDraft(input)!==initialDraft||JSON.stringify(drafts)!==initialModes));
