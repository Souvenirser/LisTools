import {initTool,clearStatus,showError,setStatus} from './tools/shared/office.js';
import {actionArea} from './tools/shared/workspace.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import {t,onLanguageChange,translateDOM} from './i18n.js';
import {calculateWage,calculateBonus,calculateAnnual,calculateWageWithPolicy,wageComputation,shanghaiPeriod} from './tools/payroll/tax.js';
import {sameSalaryMonths,manualWagePayment,bonusForMonths} from './tools/payroll/tax-input.js';
import {mountDeductionAssistant} from './tools/payroll/deduction-assistant.js';
import {calculateContributions} from './tools/payroll/contributions.js';
import {resolveEstimatePolicy as resolvePolicy} from './tools/payroll/policy.js';
import {copyText} from './tools/shared/page.js';
import {combinePayrollResults,annualBasisForBonus} from './tools/payroll/tax-summary.js';
import {buildPayrollBreakdowns,renderPayrollBreakdowns,payrollBreakdownRows} from './tools/payroll/breakdown.js';
import './tools/payroll/summary-style.css';
import {D,amount,fail,percent} from './tools/payroll/money.js';
import {$,field,select,check,note,value,cityMarkup,mountCity,resultsView,renderRows,attachExports,setReady,basicDeductionSettings,mountBasicDeduction,financialDraft,formatMoney} from './tools/payroll/ui.js';

// Adapt the simple form to the existing cumulative-tax core; amounts never persist.
document.body.classList.add('payroll-page');
const {year,month}=shanghaiPeriod();
const details=(id,key,body)=>`<details id="${id}"><summary data-i18n="${key}"></summary>${body}</details>`;
const assistantButton=prefix=>`<button type="button" class="tax-text-action" id="${prefix}-help" data-i18n="taxEase.helpDeduction"></button>`;
const citySettings=prefix=>`<div id="${prefix}-city-settings"><div class="payroll-fields">${cityMarkup(prefix)}${field(prefix+'-housing','payroll.housingEmployee','12')}</div><div class="tax-city-profile">${select(prefix+'-tier','payroll.medicalTier',[['0','payroll.tier1'],['1','payroll.tier2']],'0')}${check(prefix+'-hukou','payroll.hukou')}</div></div>`;
const annualRow=n=>details(`tax-month-${n}`,'',`<span class="sr-only">${n}</span>${check(`tax-a-${n}-active`,'payroll.active',true)}${check(`tax-a-${n}-predicted`,'payroll.predicted',n>month)}${select(`tax-a-${n}-history`,'taxFinance.monthHistory',[['estimate','payroll.estimate'],['actual','taxFinance.confirmedActual'],['none','taxFinance.confirmedNoIncome']],'estimate')}${check(`tax-a-${n}-manual`,'payroll.manual')}<div class="payroll-fields">${field(`tax-a-${n}-salary`,'payroll.salary')}${field(`tax-a-${n}-contributions`,'taxEase.personalPayment')}${field(`tax-a-${n}-special`,'payroll.special','0')}${field(`tax-a-${n}-other`,'payroll.other','0')}</div>${check(`tax-a-${n}-reduced`,'taxEase.reduced')}${field(`tax-a-${n}-deductible`,'payroll.deductible')}${field(`tax-a-${n}-adjustment`,'payroll.adjustment','0')}`);
initTool('tax',`<div class="payroll-workspace tax-workspace"><section class="tool-card" id="tax-input">${field('tax-year','payroll.year',year,'number','min="2026" max="9999"')}<section data-tax-task="wage">
<div class="payroll-period-row tax-period-row">${field('tax-period','taxEase.viewPeriod',`${year}-${String(month).padStart(2,'0')}`,'month','min="2026-01" max="9999-12"')}${select('tax-source','payroll.contributionSource',[['city','payroll.fromCity'],['manual','taxEase.usePayment']],'city')}</div>
<div hidden>${field('tax-month','payroll.period',month,'number')}${select('tax-mode','payroll.wageMode',[['quick','payroll.quick'],['actual','payroll.actual']],'quick')}</div>
<div id="tax-wage-columns"><section id="tax-current-fields"><h2 id="tax-current-heading" data-i18n="payroll128.thisMonth" hidden></h2>
${citySettings('tax')}
<div class="payroll-fields tax-amount-fields">${field('tax-salary','taxEase.monthlySalary')}<div class="tax-deduction-total">${field('tax-special','payroll.special','0')}${assistantButton('tax')}</div></div>
<div class="tax-bonus-main">${field('tax-bonus-months','taxUnified.bonusMonths','0','text','list="tax-bonus-month-options" aria-describedby="tax-bonus-basis"')}<datalist id="tax-bonus-month-options">${[0,1,2,3,4].map(n=>`<option value="${n}"></option>`).join('')}</datalist>${field('tax-bonus','payroll.bonusAmount','0')}</div><p id="tax-bonus-basis" class="tool-note"></p>
<div id="tax-payment-preview" class="payroll-payment-preview" hidden></div>
<div id="tax-manual">${field('tax-contributions','taxEase.personalPayment')}${note('payroll128.paymentHint')}</div>
<div class="tax-assumption-line"><p class="tool-note" id="tax-assumption"></p><button type="button" class="tax-text-action" id="tax-edit-employment" data-i18n="payroll128.edit"></button></div>
${details('tax-employment','taxEase.employment',`${field('tax-startMonth','payroll.startMonth','1','number','min="1" max="12"')}${basicDeductionSettings('tax')}${check('tax-firstConfirmed','taxEase.firstConfirmed')}`)}
${details('tax-city-options','insuranceEase.actualBases',`${select('tax-base-mode','payroll.baseMode',[['estimate','payroll.estimate'],['actual','payroll.actualBase']],'estimate')}<div id="tax-base-fields" class="payroll-fields">${field('tax-base','insuranceEase.socialBase')}${field('tax-base-housing','insuranceEase.housingBase')}${['pension','medical','unemployment'].map(id=>field('tax-base-'+id,'payroll.item_'+id)).join('')}</div>${note('insuranceEase.baseOverrides')}`)}
${details('tax-advanced','taxEase.specialPayments',`${check('tax-exception','tax.exceptionalPayment')}${check('tax-reduced','taxEase.reduced')}<div hidden>${check('tax-sameDeduction','payroll.sameDeduction',true)}</div>${field('tax-deductibleContributions','payroll.deductible')}${field('tax-other','payroll.other','0')}${field('tax-taxableAdjustment','payroll.adjustment','0')}`)}
<button type="button" class="tax-text-action" id="tax-check" data-i18n="payroll128.checkPayslip"></button></section>
<section id="tax-previous" hidden><h2 data-i18n="payroll128.previousMonths"></h2>${note('taxEase.previousHint')}<div class="payroll-fields">${['Income','Contributions','Special','Withheld'].map(k=>field('tax-previous'+k,'payroll.previous'+k)).join('')}</div>${field('tax-previousBasic','payroll.previousBasic','0','text','readonly')}${check('tax-overrideBasic','taxEase.overrideBasic')}${field('tax-previousOther','payroll.previousOther','0')}${field('tax-previousAdjustment','payroll.previousAdjustment','0')}</section></div>
<p class="tool-note" id="tax-first-month-note" data-i18n="tax.firstMonthZero" hidden></p>
<div class="tool-actions" id="tax-actions"><button type="button" class="primary" id="tax-run" data-i18n="taxUnified.run"></button><button type="button" class="primary" id="tax-bonus-run" data-i18n="taxEase.runBonus" hidden></button><button type="button" class="primary" id="tax-annual-run" data-i18n="taxEase.runAnnual" hidden></button></div>
</section><details data-tax-task="bonus" id="tax-bonus-section"><summary data-i18n="taxUnified.bonusSettings"></summary><div class="payroll-fields">${field('tax-bonusMonth','taxUnified.bonusMonth','','number','min="1" max="12"')}${select('tax-bonus-method','taxUnified.bonusMethod',[['separate','taxUnified.bonusSeparate'],['combined','taxUnified.bonusCombined']],'separate')}</div>${field('tax-bonusWithheld','taxUnified.bonusActual')}${check('tax-compare','taxEase.compareBonus')}<div id="tax-baseline" hidden>${note('taxEase.bonusBaseline')}<button type="button" id="tax-use-wage" data-i18n="taxEase.useWage"></button>${field('tax-bonusAnnualSalary','payroll.annualGross')}<div class="payroll-fields">${field('tax-bonusAnnualContributions','payroll.annualContributions','0')}${field('tax-bonusAnnualSpecial','payroll.annualSpecial','0')}${field('tax-bonusAnnualOther','payroll.annualOther','0')}${field('tax-bonusAnnualMedical','payroll.medicalAnnual','0')}${field('tax-bonusAnnualAdjustment','payroll.adjustment','0')}</div></div>${note('payroll.bonusHint')}</details>
<details data-tax-task="annual" id="tax-annual-section"><summary data-i18n="taxUnified.yearlySettings"></summary>${note('taxUnified.sharedInputs')}${select('tax-annual-mode','taxEase.annualMode',[['same','taxEase.sameEveryMonth'],['monthly','taxEase.editMonths']],'same')}<div id="tax-annual-policy">${select('tax-annual-source','payroll.contributionSource',[['city','payroll.fromCity'],['manual','taxEase.usePayment']],'city')}${citySettings('tax-annual')}</div>
<div id="tax-annual-same"><div class="payroll-fields">${field('tax-annual-salary','taxEase.monthlySalary')}${field('tax-annual-contributions','taxEase.personalPayment')}</div>${note('taxEase.paymentHint')}<div class="tax-deduction-total">${field('tax-annual-special','payroll.special','0')}${assistantButton('tax-annual')}</div>${note('taxEase.specialHint')}
${details('tax-annual-payments','taxEase.specialPayments',`${check('tax-annual-reduced','taxEase.reduced')}${field('tax-annual-deductible','payroll.deductible')}${field('tax-annual-other','payroll.other','0')}${field('tax-annual-adjustment','payroll.adjustment','0')}`)}</div>

<div id="tax-months" hidden><p class="tool-note" data-i18n="taxEase.monthDraftHint"></p><button type="button" id="tax-annual-fill" data-i18n="taxEase.refill"></button><div class="payroll-months">${Array.from({length:12},(_,i)=>annualRow(i+1)).join('')}</div></div>
${details('tax-annual-options','taxEase.annualOptions',`${basicDeductionSettings('tax-annual',{annual:true})}${field('tax-annualSpecialDeduction','taxEase.annualSpecial','0')}${note('taxEase.annualSpecialHint')}${field('tax-medicalDeduction','payroll.medicalAnnual','0')}${field('tax-actualWithheld','taxUnified.actualWageWithheld')}${note('taxFinance.refundRequirements')}`)}</details></section>${resultsView('tax')}<section class="tool-card payroll-annual-card" id="tax-result-months" hidden><h2 data-i18n="payroll.months"></h2><p class="tool-note" id="tax-months-context"></p><div id="tax-months-table"></div></section></div>`);
const title=document.querySelector('#tool-root h1');title.id='tax-title';title.closest('main').setAttribute('aria-labelledby',title.id);
for(let n=1;n<=12;n++){const summary=$(`tax-month-${n}`).querySelector('summary');summary.removeAttribute('data-i18n');summary.textContent=String(n).padStart(2,'0');}
$('tax-year').closest('.field').classList.add('payroll-year-context');
const basicDeduction=mountBasicDeduction('tax'),annualDeduction=mountBasicDeduction('tax-annual');mountCity('tax');mountCity('tax-annual');
const housingEdited={tax:false,'tax-annual':false};for(const prefix of ['tax','tax-annual']){const control=$(prefix+'-city').closest('.choices');control.id=prefix+'-city-control';control.tabIndex=0;$(prefix+'-housing').addEventListener('input',()=>housingEdited[prefix]=true);$(prefix+'-city').addEventListener('change',()=>{syncHousingDefault(prefix);invalidate();visibility();});}
function syncHousingDefault(prefix){if(housingEdited[prefix])return;try{const p=resolvePolicy(value(prefix+'-city'),`${value('tax-year')}-${String(value('tax-month')).padStart(2,'0')}`),rate=p.items.find(i=>i.id==='housing').rateMax;$(prefix+'-housing').value=new D(rate).mul(100).toString();}catch{/* Explicit submit reports an unavailable city or month. */}}
const states={wage:{},bonus:{},annual:{}};let task='wage',rows=[],unified,unifiedForm='',breakdowns,displayedWage,resultPayment,monthlyPrepared=false,previousBasicKey='',forecastYear=String(year),bonusEntry='months';
const assistants=['tax','tax-annual'].map(prefix=>{const a=mountDeductionAssistant(prefix,prefix==='tax'?'tax-special':'tax-annual-special',()=>invalidate());$(prefix+'-help').onclick=event=>a.open(event.currentTarget);return a;});
const taxActionArea=actionArea($('tax-actions'),$('tool-status'),{resultTarget:$('tax-result'),hasResult:()=>Object.values(states).some(s=>s.result)});
function chooseTask(id){
 task='wage';if(id==='bonus'||id==='annual'){const target=$(id==='bonus'?'tax-bonus-section':'tax-annual-section');target.open=true;target.scrollIntoView({block:'nearest'});}
}
const cityConditions=document.createElement('details');cityConditions.id='tax-city-conditions';cityConditions.innerHTML='<summary data-i18n="taxUnified.cityConditions"></summary>';
$('tax-employment').before(cityConditions);cityConditions.append(document.querySelector('#tax-city-settings .tax-city-profile'));
$('tax-annual-policy').hidden=true;
for(const id of ['tax-annual-same','tax-annual-payments'])$(id).hidden=true;
const paymentSettings=prefix=>({baseMode:value('tax-base-mode'),base:value('tax-base'),bases:Object.fromEntries(['pension','medical','unemployment','housing'].filter(id=>value('tax-base-'+id)).map(id=>[id,value('tax-base-'+id)]))});
function contribution(salary,city,year,month,housing,profile={}){
 const policy=resolvePolicy(city,`${year}-${String(month).padStart(2,'0')}`,profile);
 const rate=percent(housing,'tax-housing');return calculateContributions({salary,mode:profile.baseMode==='actual'?'actual':'estimate',base:profile.base,bases:profile.bases,excluded:new D(rate).isZero()?['housing']:[],rates:{housing:{employee:rate,employer:rate}}},policy);
}
function cityContribution(prefix,salary,n,settings={}){try{
 const c=contribution(salary,value(prefix+'-city'),value('tax-year'),n,value(prefix+'-housing'),{...paymentSettings(prefix),...settings,tier:value(prefix+'-tier'),hukou:$(prefix+'-hukou').checked});
 return {...c,taxDeductible:settings.deductibleContributions===undefined?c.taxDeductible:amount(settings.deductibleContributions,'deductibleContributions').toFixed(2),taxableAdjustment:new D(c.taxableAdjustment).plus(amount(settings.taxableAdjustment,'taxableAdjustment',0)).toFixed(2)};
 }catch(error){if(['tax-housing','employee-housing','employer-housing'].includes(error.field))error.field=prefix+'-housing';throw error;}}
function manualPayment(cashId,deductibleId,reducedId){const cash=amount(value(cashId),cashId).toFixed(2),wage=cashId==='tax-contributions';
 if(!wage||value('tax-mode')==='actual')return {contributions:cash,deductibleContributions:$(reducedId).checked?amount(value(deductibleId),deductibleId).toFixed(2):cash};
 try{let limit;if(value('tax-city')){const p=resolvePolicy(value('tax-city'),value('tax-period')),housing=p.items.find(i=>i.id==='housing');limit=calculateContributions({salary:'999999999999999',rates:{housing:{employee:housing.rateMax,employer:housing.rateMax}}},p).employeeTotal;}
  return manualWagePayment({salary:value('tax-salary'),contributions:cash,limit,exception:$('tax-exception').checked,...($('tax-reduced').checked||$('tax-exception').checked?{deductibleContributions:value(deductibleId)}:{})});
 }catch(error){if(['contributions','deductibleContributions'].includes(error.field))error.field='tax-'+error.field;throw error;}
}
function completedMonths(){
 const current=shanghaiPeriod(),selected=Number(value('tax-year'));
 return selected<current.year?12:selected>current.year?0:current.month;
}
function sameMonths(){syncAnnualInputs();const city=value('tax-annual-source')==='city';return sameSalaryMonths({salary:value('tax-annual-salary'),...(city?{contributions:'0',...($('tax-annual-reduced').checked?{deductibleContributions:amount(value('tax-annual-deductible'),'tax-annual-deductible').toFixed(2)}:{})}:manualPayment('tax-annual-contributions','tax-annual-deductible','tax-annual-reduced')),specialDeduction:value('tax-annual-special'),otherDeduction:value('tax-annual-other'),taxableAdjustment:value('tax-annual-adjustment')},completedMonths());}
function applyMonthlyPolicies(months){return months.map(row=>{if(value('tax-annual-source')!=='city'||row.manualContributions||row.confirmedNoIncome)return row;try{const reduced=value('tax-annual-mode')==='same'?$('tax-annual-reduced').checked:$(`tax-a-${row.month}-reduced`).checked,c=cityContribution('tax-annual',row.salary,row.month,{...row,deductibleContributions:reduced?row.deductibleContributions:undefined});return {...row,contributions:c.employeeTotal,deductibleContributions:c.taxDeductible,taxableAdjustment:c.taxableAdjustment,employeeSocial:c.employeeSocial,employeeHousing:c.employeeHousing,payment:c,policy:c.conditions};}catch(error){if(error.field!=='tax-annual-housing'){const field={salary:'salary',deductibleContributions:'deductible',taxableAdjustment:'adjustment'}[error.field];error.field=field?`${field}-${row.month}`:'tax-annual-city';}throw error;}});}
function annualInput(){
 const elapsed=completedMonths();
 const months=value('tax-annual-mode')==='same'?sameMonths():Array.from({length:12},(_,i)=>i+1).filter(n=>$(`tax-a-${n}-active`).checked).map(n=>{
  const predicted=n>elapsed||$(`tax-a-${n}-predicted`).checked,history=value(`tax-a-${n}-history`);
  if(!predicted&&history==='none')return {month:n,predicted,confirmedNoIncome:true,salary:'0',contributions:'0'};
  const manualContributions=$(`tax-a-${n}-manual`).checked;
  const payments=value('tax-annual-source')==='city'&&!manualContributions?{contributions:'0',...($(`tax-a-${n}-reduced`).checked?{deductibleContributions:value(`tax-a-${n}-deductible`)}:{})}:manualPayment(`tax-a-${n}-contributions`,`tax-a-${n}-deductible`,`tax-a-${n}-reduced`);
  return {month:n,predicted,confirmedActual:history==='actual',estimated:history==='estimate',salary:value(`tax-a-${n}-salary`),...payments,specialDeduction:value(`tax-a-${n}-special`),otherDeduction:value(`tax-a-${n}-other`),taxableAdjustment:value(`tax-a-${n}-adjustment`),manualContributions};
 });
 return {year:value('tax-year'),...annualDeduction.read(),medicalDeduction:value('tax-medicalDeduction'),annualSpecialDeduction:value('tax-annualSpecialDeduction'),actualWithheld:value('tax-actualWithheld'),months:applyMonthlyPolicies(months),entryMode:value('tax-annual-mode')};
}
function read(){
 if(task==='wage'&&!/^\d{4}-\d{2}$/.test(value('tax-period')))fail('tax.monthRange','tax-period');
 if(!/^\d{4}$/.test(value('tax-year'))||Number(value('tax-year'))<2026)fail('tax.year','tax-year');
 if(task==='bonus'){const n=value('tax-bonusMonth');if(n.trim()&&(!Number.isInteger(Number(n))||Number(n)<1||Number(n)>12))fail('tax.monthRange','tax-bonusMonth');return {year:value('tax-year'),bonus:value('tax-bonus'),entryMode:bonusEntry,bonusMonths:value('tax-bonus-months'),...($('tax-compare').checked?{annualBasis:{salary:value('tax-bonusAnnualSalary'),contributions:value('tax-bonusAnnualContributions'),special:value('tax-bonusAnnualSpecial'),other:value('tax-bonusAnnualOther'),medical:value('tax-bonusAnnualMedical'),adjustment:value('tax-bonusAnnualAdjustment')}}:{})};}
 if(task==='annual')return annualInput();
 const input={year:value('tax-year'),mode:value('tax-mode')==='actual'?'actual':'estimate',predicted:Number(value('tax-month'))>completedMonths(),month:value('tax-month'),startMonth:value('tax-startMonth'),...basicDeduction.read(),salary:amount(value('tax-salary'),'tax-salary').toFixed(2),specialDeduction:value('tax-special'),otherDeduction:value('tax-other'),taxableAdjustment:value('tax-taxableAdjustment')};
 if(input.basicDeductionMode==='first-employment'&&!$('tax-firstConfirmed').checked)fail('tax.easeFirstConfirmation','tax-firstConfirmed');
 if(value('tax-source')==='city'){
  if($('tax-reduced').checked)input.deductibleContributions=amount(value('tax-deductibleContributions'),'tax-deductibleContributions').toFixed(2);
  if(input.mode==='estimate')Object.assign(input,{city:value('tax-city'),housing:value('tax-housing'),tier:value('tax-tier'),hukou:$('tax-hukou').checked,...paymentSettings('tax')});
  else {const c=cityContribution('tax',input.salary,input.month,input);Object.assign(input,{contributions:c.employeeTotal,deductibleContributions:c.taxDeductible,taxableAdjustment:c.taxableAdjustment,policy:c.conditions});}
 }else Object.assign(input,manualPayment('tax-contributions','tax-deductibleContributions','tax-reduced'),{limitCity:value('tax-city'),paymentException:$('tax-exception').checked});
 if(input.mode==='actual'&&Number(input.month)!==Number(input.startMonth)){
  input.previous=Object.fromEntries(['income','contributions','special','other','basic','adjustment','withheld'].map(k=>[k,value('tax-previous'+k[0].toUpperCase()+k.slice(1))]));
  for(const k of ['income','contributions','special','withheld'])if(!input.previous[k].trim())fail('tax.previousRequired','tax-previous'+k[0].toUpperCase()+k.slice(1));
 }
 return input;
}
function wageResult(input){return input.city!==undefined?calculateWageWithPolicy(input,n=>cityContribution('tax',input.salary,n,input)):calculateWage(input);}
function wageMonths(input){if(input.mode!=='estimate')return [];return Array.from({length:13-Number(input.startMonth)},(_,i)=>Number(input.startMonth)+i).map(n=>{try{const r=wageResult({...input,month:n}),c=input.city!==undefined?cityContribution('tax',input.salary,n,input):input;return {month:n,computation:wageComputation(r),estimated:true,predicted:n>completedMonths(),salary:input.salary,specialDeduction:input.specialDeduction,otherDeduction:input.otherDeduction,taxableAdjustment:c.taxableAdjustment??input.taxableAdjustment,contributions:c.employeeTotal??c.contributions,deductibleContributions:c.taxDeductible??c.deductibleContributions,employeeSocial:c.employeeSocial,employeeHousing:c.employeeHousing,payment:input.city!==undefined?c:null,policy:c.conditions,withheld:r.currentTax,net:r.net};}catch(error){return {month:n,estimated:true,predicted:n>completedMonths(),unavailable:error.code||'office.error',field:error.field,params:error.params};}});}
const definitions={wage:[['net',true,'net'],['currentTax'],['contributions',false,'cashContributions'],['salary'],['cumulativeIncome'],['cumulativeTaxable'],['cumulativeTax'],['basicDeduction'],['rate',false,'taxRate'],['quick',false,'quickDeduction']],bonus:[['bonusNet',true],['separateTax'],['separateTotal'],['combinedTotal'],['saving'],['rate',false,'taxRate'],['quick',false,'quickDeduction']],annual:[['cashAfterAnnualTax',true,'annualCash'],['annualTax'],['gross',false,'annualGross'],['contributions',false,'annualContributions'],['predictedWithheld'],['actualWithheld'],['refund']]};
function renderMonths(months,host){const breakdown=months.some(m=>m.employeeSocial!==undefined),paidBonus=months.some(m=>m.bonus&&new D(m.bonus).gt(0)),keys=['month','salary',...(paidBonus?['bonusAmount']:[]),'cashContributions',...(breakdown?['socialTotal','housingTotal']:[]),'predictedWithheld','net'];const table=document.createElement('table');table.className='payroll-table';const head=document.createElement('thead'),tr=document.createElement('tr');for(const key of keys){const th=document.createElement('th');th.textContent=t('payroll.'+key);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=document.createElement('tbody');for(const row of months){const tr=document.createElement('tr');if(row.unavailable){const n=document.createElement('td'),reason=document.createElement('td');n.textContent=String(row.month);reason.colSpan=keys.length-1;reason.textContent=t('taxEase.unavailableMonth')+' · '+t(row.unavailable,row.params);tr.append(n,reason);}else for(const text of [String(row.month)+(row.predicted?' · '+t('payroll.predicted'):row.confirmedNoIncome?' · '+t('taxFinance.confirmedNoIncome'):row.confirmedActual?' · '+t('taxFinance.confirmedActual'):row.estimated?' · '+t('payroll.estimate'):''),formatMoney(row.salary),...(paidBonus?[formatMoney(row.bonus)]:[]),formatMoney(row.contributions),...(breakdown?[row.employeeSocial===undefined?'—':formatMoney(row.employeeSocial),row.employeeHousing===undefined?'—':formatMoney(row.employeeHousing)]:[]),formatMoney(row.totalWithheld??row.withheld),formatMoney(row.totalNet??row.net)]){const td=document.createElement('td');td.dir='ltr';td.textContent=text;tr.append(td);}if(Number(row.month)===Number(value('tax-month')))tr.classList.add('is-current-month');body.append(tr);}table.append(body);if(!months.some(row=>row.unavailable)){const foot=document.createElement('tfoot'),total=document.createElement('tr');for(const key of keys){const cell=document.createElement('td');if(key==='month')cell.textContent=t('payroll128.total');else {const property={salary:'salary',bonusAmount:'bonus',socialTotal:'employeeSocial',housingTotal:'employeeHousing',cashContributions:'contributions',predictedWithheld:paidBonus?'totalWithheld':'withheld',net:paidBonus?'totalNet':'net'}[key];cell.textContent=months.some(row=>row[property]===undefined)?'—':formatMoney(months.reduce((sum,row)=>sum.plus(row[property]),new D(0)));cell.dir='ltr';}total.append(cell);}foot.append(total);table.append(foot);}const scroll=document.createElement('div');scroll.className='payroll-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',t('payroll.months'));scroll.append(table);host.append(scroll);}
function hasBonusAmount(){try{return !amount(value('tax-bonus'),'tax-bonus',0).isZero();}catch{return true;}}
function syncBonus(validate=false){
 try{
  if(bonusEntry==='months')$('tax-bonus').value=bonusForMonths(value('tax-salary'),value('tax-bonus-months'));
  else {const salary=amount(value('tax-salary'),'tax-salary',0),bonus=amount(value('tax-bonus'),'tax-bonus',0);$('tax-bonus-months').value=salary.gt(0)?bonus.div(salary).toDecimalPlaces(6).toString():'0';}
 }catch(error){if(bonusEntry==='months')$('tax-bonus').value='';if(validate)throw error;}
 $('tax-bonus-basis').textContent=t(bonusEntry==='months'?'taxUnified.bonusMonthly':'taxUnified.bonusAmountMode');
}
function syncAnnualInputs(){
 for(const [from,to]of [['salary','salary'],['contributions','contributions'],['special','special'],['other','other'],['taxableAdjustment','adjustment'],['deductibleContributions','deductible'],['source','source'],['housing','housing'],['city','city'],['tier','tier']])$('tax-annual-'+to).value=value('tax-'+from);
 $('tax-annual-reduced').checked=$('tax-reduced').checked;$('tax-annual-hukou').checked=$('tax-hukou').checked;
}
function paymentContext(payment){
 const policy=payment?.conditions;
 if(!policy)return '';
 const housing=payment.items.find(item=>item.id==='housing');
 return [policy.cityName,policy.month,t('taxFinance.autoRatioEstimate'+(policy.reference?'Reference':'Verified')),housing?t('payroll.housingEmployee')+' '+new D(housing.employeeRate??0).mul(100).toString()+'%':null].filter(Boolean).join(' · ');
}
function render(){
 const open=[...$('tax-values').querySelectorAll('details[open]')].map(n=>n.id),oldScroll=$('tax-result-months').querySelector('.payroll-table-scroll')?.scrollTop||0;
 const wage=states.wage.result,bonus=states.bonus.result,annual=states.annual.result;
 const current=wage?.conditions.mode!=='actual'&&unified?.months.find(row=>Number(row.month)===Number(value('tax-month')));
 const wageMonth=wage?.conditions.mode!=='actual'&&annual?.months.find(row=>Number(row.month)===Number(value('tax-month')));
 const effective=wage&&wageMonth?{...wage,...wageMonth.computation,net:wageMonth.net,currentTax:wageMonth.withheld,salary:wageMonth.salary,contributions:wageMonth.contributions}:wage;
 displayedWage=effective;resultPayment=wageMonth?.payment??states.wage.payment;rows=[];if(effective)rows.push(...definitions.wage.map(([key,main,label])=>[key,key==='net'?'taxFinance.wageNet':'payroll.'+(label||key),key==='rate'?new D(effective[key]).mul(100).toString()+'%':effective[key],main]));
 if(current?.bonus&&new D(current.bonus).gt(0))rows.push(['bonusGross','payroll.bonusAmount',current.bonus],['monthNetWithBonus','taxFinance.monthNetWithBonus',current.totalNet]);
 if(bonus)rows.push(...definitions.bonus.filter(([key])=>bonus[key]!==null&&bonus[key]!==undefined&&!['rate','quick'].includes(key)&&!(value('tax-bonus-method')==='combined'&&bonus.combinedTotal!==null&&['bonusNet','separateTax'].includes(key))).map(([key,main,label])=>[key,'payroll.'+(label||key),bonus[key],main]));
 if(bonus&&value('tax-bonus-method')==='combined'&&bonus.combinedTotal!==null){const extra=new D(bonus.combinedTotal).minus(new D(bonus.separateTotal).minus(bonus.separateTax));rows.push(['bonusNet','taxUnified.bonusIncrementalNet',new D(bonus.conditions.bonus).minus(extra).toFixed(2),true],['bonusCombinedTax','taxUnified.bonusIncrementalTax',extra.toFixed(2)]);}
 if(unified)rows.push(['totalIncome','taxUnified.annualTotalIncome',unified.totalIncome],['totalAnnualTax','taxUnified.annualTotalTax',unified.totalAnnualTax],['annualNet','taxFinance.annualNetEstimate',unified.annualNet,true],['gross','payroll.annualGross',annual.gross],['annualTax','payroll.annualTax',annual.annualTax]);
 else if(annual)rows.push(['gross','payroll.annualGross',annual.gross],['annualTax','payroll.annualTax',annual.annualTax],['annualNet','taxFinance.annualNetEstimate',annual.cashAfterAnnualTax,true]);
 const refund=unified?.refund;if(refund!==null&&refund!==undefined)rows.push(['refund',new D(refund).isNegative()?'taxEase.extraTax':'taxEase.refund',new D(refund).abs().toFixed(2)]);
 renderRows('tax',rows);setReady('tax',rows.length>0);$('tax-result-months').hidden=true;$('tax-months-table').replaceChildren();breakdowns=undefined;
 if(!rows.length)return;
 const root=$('tax-values'),dl=root.firstElementChild;dl.classList.add('payroll-summary-grid');const technical=document.createElement('details');technical.id='tax-process';const title=document.createElement('summary');title.textContent=t('taxEase.process');technical.append(title);const tech=document.createElement('dl');tech.className='payroll-values';technical.append(tech);
 const primary=new Set(['net','currentTax','contributions','salary','bonusGross','monthNetWithBonus','bonusNet','bonusCombinedTax','separateTax','separateTotal','combinedTotal','saving','totalIncome','totalAnnualTax','annualNet','refund']);
 for(const group of [...dl.children]){const out=group.querySelector('output'),key=out.dataset.value,raw=rows.find(row=>row[0]===key)[2];if(key!=='rate')out.textContent=formatMoney(raw);if(primary.has(key))group.querySelector('button').hidden=true;else tech.append(group);}
 const bonusSection=document.createElement('section');bonusSection.id='tax-bonus-result';const bonusHeading=document.createElement('h3');bonusHeading.textContent=t('payroll.bonusAmount');bonusSection.append(bonusHeading);const bonusList=document.createElement('dl');bonusList.className='payroll-values payroll-summary-grid';bonusSection.append(bonusList);
 const annualSection=document.createElement('section');annualSection.id='tax-annual-result';const annualHeading=document.createElement('h3');annualHeading.textContent=t('payroll128.annual');annualSection.append(annualHeading);const annualList=document.createElement('dl');annualList.className='payroll-values payroll-summary-grid';annualSection.append(annualList);
 for(const group of [...dl.children]){const key=group.querySelector('output').dataset.value;if(['bonusNet','bonusCombinedTax','separateTax','separateTotal','combinedTotal','saving'].includes(key))bonusList.append(group);else if(['totalIncome','totalAnnualTax','annualNet','refund'].includes(key))annualList.append(group);}
 if(!dl.children.length)dl.remove();
 if(wage){const condition=document.createElement('p');condition.className='tax-condition';condition.textContent=[current&&value('tax-annual-mode')==='monthly'?t('taxUnified.monthlyContext',{month:current.month}):t(wage.conditions.mode==='estimate'||states.wage.input?.predicted?'taxEase.estimateContext':'taxEase.actualContext',{year:wage.conditions.year,month:wage.conditions.month,start:wage.conditions.startMonth}),states.wage.input?.predicted?t('payroll.predicted'):null,paymentContext(wageMonth?.payment??states.wage.payment)].filter(Boolean).join(' · ');root.prepend(condition);const formula=document.createElement('p');formula.className='tool-note';formula.textContent=t('taxEase.netFormula');root.append(formula);
  const payment=wageMonth?.payment??(value('tax-annual-mode')==='monthly'?null:states.wage.payment),hasCurrentBonus=Number(current?.bonus)>0,gross=hasCurrentBonus?new D(effective.salary).plus(current.bonus).toFixed(2):effective.salary;
  breakdowns=buildPayrollBreakdowns({gross,net:hasCurrentBonus?current.totalNet:effective.net,tax:hasCurrentBonus?current.totalWithheld:effective.currentTax,employeeTotal:effective.contributions,contributions:payment,...(hasCurrentBonus?{grossLabel:'payroll.salary+taxEase.bonus'}:{})});const chart=document.createElement('div');chart.id='tax-breakdowns';renderPayrollBreakdowns(chart,breakdowns);root.append(chart);
 }
 if(bonusList.children.length)root.append(bonusSection);if(annualList.children.length)root.append(annualSection);
 if(unified?.unallocatedBonus){const p=document.createElement('p');p.id='tax-bonus-unallocated';p.className='tool-note';p.textContent=t('taxUnified.bonusUnallocated');root.append(p);}
 const errors=Object.values(states).filter(s=>s.error);if(errors.length){const p=document.createElement('p');p.id='tax-partial';p.className='tax-condition';p.setAttribute('role','status');p.textContent=t('taxUnified.partial');root.append(p);}
 if(tech.children.length)root.append(technical);
 const months=unified?.months||annual?.months||states.wage.months;if(months?.length){$('tax-result-months').hidden=false;$('tax-months-context').textContent=t('payroll.quickHint');renderMonths(months,$('tax-months-table'));$('tax-result-months').querySelector('.payroll-table-scroll')?.scrollTo(0,oldScroll);}
 if(annual&&refund==null){const p=document.createElement('p');p.id='tax-forecast-note';p.className='tool-note';p.textContent=t('taxFinance.refundRequirements');root.append(p);}
 for(const id of open)if($(id))$(id).open=true;
}
const currentDraft=()=>JSON.stringify([shanghaiPeriod(),financialDraft($('tax-input'))]);
function invalidate(){if(unifiedForm===currentDraft()&&Object.values(states).some(s=>s.result))return;const had=Object.values(states).some(s=>s.result||s.stale);for(const key of Object.keys(states))states[key]={stale:had};unified=undefined;unifiedForm='';clearStatus();render();if(had)setStatus('ux.stale');}
function fieldFor(error,scope=task){const task=scope;if(error.code==='tax.policyMissing'||error.field==='city'||error.field==='tax-annual-city')return 'tax-city-control';if(['year','tax-year'].includes(error.field))return 'tax-period';if($(error.field))return error.field;const key=error.field||'salary';if(task==='annual'){
 if(['basicDeductionMode','annualReliefConfirmed'].includes(key))return 'tax-annual-'+key;
 if(value('tax-annual-mode')==='same'){const m=/^(salary|contributions|deductible|special|other|adjustment)-\d+$/.exec(key);if(m)return 'tax-annual-'+m[1];}
 const match=/^(salary|contributions|deductible|special|other|adjustment)-(\d+)$/.exec(key);if(match)return `tax-a-${match[2]}-${match[1]}`;
 }
 const direct=key==='specialDeduction'?'tax-special':key==='otherDeduction'?'tax-other':'tax-'+key;if($(direct))return direct;return task==='bonus'?'tax-bonus':task==='annual'?'tax-annual-mode':'tax-salary';}
function run(){
 if(unifiedForm===currentDraft()&&Object.values(states).some(s=>s.result)&&!Object.values(states).some(s=>s.error))return;
 clearStatus();for(const key of Object.keys(states))states[key]={};unified=undefined;const errors=[];let bonusIssue;try{syncBonus(true);}catch(error){bonusIssue=error;}
 const attempt=(scope,fn)=>{task=scope;try{const result=fn();states[scope]={...states[scope],result};}catch(error){states[scope]={error};errors.push({error,scope});}};
 const hasWage=value('tax-salary').trim()!=='',hasBonus=Boolean(bonusIssue)||hasBonusAmount(),hasMonthly=monthlyPrepared&&value('tax-annual-mode')==='monthly';
 if(hasWage||!hasBonus&&!hasMonthly)attempt('wage',()=>{const input=read(),result=wageResult(input),payment=value('tax-source')==='city'?cityContribution('tax',input.salary,input.month,input):null;states.wage.input=input;states.wage.payment=payment;states.wage.months=wageMonths(input);Object.assign(result,{salary:input.salary,contributions:payment?.employeeTotal??input.contributions});return result;});
 if(hasWage&&value('tax-mode')!=='actual'||hasMonthly)attempt('annual',()=>{
  syncAnnualInputs();let input;if(value('tax-annual-mode')==='monthly')input=annualInput();else {const months=states.wage.months;if(!months?.length)fail('tax.easeNoEstimate','tax-salary');const missing=months.find(row=>row.unavailable);if(missing)fail(missing.unavailable,missing.field??'tax-city-control',missing.params);input={year:value('tax-year'),...annualDeduction.read(),medicalDeduction:value('tax-medicalDeduction'),annualSpecialDeduction:value('tax-annualSpecialDeduction'),actualWithheld:value('tax-actualWithheld'),months};}const result=calculateAnnual(input);if(value('tax-annual-mode')==='same'){result.months=result.months.map((row,i)=>({...row,withheld:input.months[i].withheld,net:input.months[i].net,computation:input.months[i].computation}));result.predictedWithheld=result.months.reduce((sum,row)=>sum.plus(row.withheld),new D(0)).toFixed(2);}return result;
 });
 if(hasBonus)attempt('bonus',()=>{if(bonusIssue)throw bonusIssue;const input=read();if(states.annual.result)input.annualBasis=annualBasisForBonus(states.annual.result);if(value('tax-bonus-method')==='combined'&&!input.annualBasis)fail('tax.easeNoEstimate','tax-bonus-method');return calculateBonus(input);});
 if(states.annual.result&&(!hasBonus||states.bonus.result))try{unified=combinePayrollResults({annual:states.annual.result,bonus:states.bonus.result,method:value('tax-bonus-method'),bonusMonth:value('tax-bonusMonth'),bonusActualWithheld:value('tax-bonusWithheld'),wageConditions:value('tax-annual-mode')==='same'?states.wage.input:null});}catch(error){states.bonus.error=error;errors.push({error,scope:'bonus'});}
 task='wage';unifiedForm=currentDraft();render();if(errors.length){const {error,scope}=errors[0];showError(error,{field:fieldFor(error,scope),focus:true});}
}
function placeActions(){const anchor=value('tax-mode')==='actual'&&!$('tax-previous').hidden?$('tax-previous'):document.querySelector('.tax-assumption-line');if(anchor.nextElementSibling!==taxActionArea)anchor.after(taxActionArea);}
function refreshPaymentPreview(){
 const host=$('tax-payment-preview');host.hidden=value('tax-source')!=='city';host.replaceChildren();if(host.hidden)return;
 const label=document.createElement('span');label.textContent=t('taxEase.personalPayment');const output=document.createElement('output');output.dir='ltr';
 const hint=document.createElement('small');let context=t('payroll.chooseCity');
 if(value('tax-city'))try{
  const c=cityContribution('tax',value('tax-salary')||'0',value('tax-month'));
  output.textContent=value('tax-salary').trim()?formatMoney(c.employeeTotal):'—';context=paymentContext(c);
 }catch{context=t('insuranceEase.policyMissing');}
 if(!output.textContent)output.textContent='—';
 hint.textContent=context;host.append(label,output,hint);
 const adjust=document.createElement('button');adjust.type='button';adjust.className='tax-text-action';adjust.textContent=t('payroll128.edit');adjust.onclick=()=>{$('tax-city-options').open=true;$('tax-base-mode').focus({preventScroll:true});};host.append(adjust);
}
function visibility(){
 const selectedYear=value('tax-year');if(/^\d{4}$/.test(selectedYear)&&Number(selectedYear)>=2026&&selectedYear!==forecastYear){const elapsed=completedMonths();for(let n=1;n<=12;n++){
  $(`tax-a-${n}-predicted`).checked=n>elapsed;
  $(`tax-a-${n}-history`).value='estimate';
 }$('tax-actualWithheld').value='';$('tax-bonusWithheld').value='';forecastYear=selectedYear;}
 const actual=value('tax-mode')==='actual',first=Number(value('tax-month'))===Number(value('tax-startMonth')),manual=value('tax-source')==='manual';
 document.querySelector('.tax-workspace').classList.toggle('is-actual',task==='wage'&&actual&&!first);$('tax-current-heading').hidden=!actual||first;
 $('tax-year').closest('.field').hidden=true;$('tax-first-month-note').hidden=!actual||!first;$('tax-previous').hidden=!actual||first;$('tax-manual').hidden=!manual;$('tax-city-settings').hidden=false;$('tax-housing').closest('.field').hidden=manual;$('tax-reduced').closest('label').hidden=false;$('tax-exception').closest('label').hidden=!manual;$('tax-deductibleContributions').closest('.field').hidden=!($('tax-reduced').checked||manual&&$('tax-exception').checked);$('tax-city-options').hidden=manual;$('tax-base-fields').hidden=value('tax-base-mode')!=='actual';$('tax-sameDeduction').checked=!$('tax-reduced').checked;$('tax-firstConfirmed').closest('label').hidden=value('tax-basicDeductionMode')!=='first-employment';
 const checkLabel=t(actual?'taxEase.backEstimate':'payroll128.checkPayslip');if($('tax-check').textContent!==checkLabel)$('tax-check').textContent=checkLabel;$('tax-assumption').textContent=t(actual?'taxEase.actualAssumption':'taxEase.sameAssumption',{start:value('tax-startMonth')});
 const basicKey=[value('tax-month'),value('tax-startMonth'),value('tax-basicDeductionMode')].join('/');if(!$('tax-overrideBasic').checked||basicKey!==previousBasicKey){const n=Number(value('tax-month'))-1,start=Number(value('tax-startMonth')),mode=value('tax-basicDeductionMode');$('tax-previousBasic').value=first?'0':String(mode==='annual-60000'?60000:5000*Math.max(0,mode==='first-employment'?n:n-start+1));previousBasicKey=basicKey;}$('tax-previousBasic').readOnly=!$('tax-overrideBasic').checked;
 $('tax-baseline').hidden=!$('tax-compare').checked;const same=value('tax-annual-mode')==='same';$('tax-annual-same').hidden=true;$('tax-months').hidden=same;$('tax-annual-city-settings').hidden=value('tax-annual-source')!=='city';$('tax-annual-contributions').closest('.field').hidden=value('tax-annual-source')==='city';document.querySelector('#tax-annual-same>[data-i18n="taxEase.paymentHint"]').hidden=value('tax-annual-source')==='city';$('tax-annual-deductible').closest('.field').hidden=!$('tax-annual-reduced').checked;
 for(const prefix of ['tax','tax-annual']){const city=value(prefix+'-city'),source=value(prefix+'-source');$(prefix+'-tier').closest('.field').hidden=source!=='city'||city!=='shenzhen';$(prefix+'-hukou').closest('label').hidden=source!=='city'||city!=='shenzhen';}
 $('tax-city-conditions').hidden=manual||value('tax-city')!=='shenzhen';placeActions();refreshPaymentPreview();$('tax-bonusWithheld').disabled=!hasBonusAmount();
 const elapsed=completedMonths();
 for(let n=1;n<=12;n++){
  const future=n>elapsed,predicted=$(`tax-a-${n}-predicted`),history=$(`tax-a-${n}-history`);
  if(future)predicted.checked=true;
  predicted.disabled=future;history.disabled=predicted.checked;
  $(`tax-month-${n}`).querySelector('summary').textContent=String(n).padStart(2,'0')+(predicted.checked?' · '+t('payroll.predicted'):'');
  const draftLocked=!predicted.checked&&history.value==='none';
  for(const suffix of ['manual','salary','contributions','special','other','reduced','deductible','adjustment'])$(`tax-a-${n}-${suffix}`).disabled=draftLocked;
  $(`tax-a-${n}-manual`).closest('label').hidden=value('tax-annual-source')!=='city';$(`tax-a-${n}-deductible`).closest('.field').hidden=!$(`tax-a-${n}-reduced`).checked;}
}
function fillMonths(confirmOverwrite,quiet=false){
 if(confirmOverwrite&&monthlyPrepared&&!confirm(t('payroll.annualFillConfirm')))return false;
 let months;try{months=sameMonths().filter(row=>row.month>=Number(value('tax-startMonth')));}catch(error){if(!quiet){$('tax-annual-mode').value='same';visibility();showError(error,{field:fieldFor(error),focus:true});}return false;}
 for(let n=1;n<=12;n++){$(`tax-a-${n}-active`).checked=months.some(row=>row.month===n);$(`tax-a-${n}-history`).value='estimate';}
 for(const row of months){const n=row.month;for(const [k,source]of [['salary','salary'],['contributions','contributions'],['deductible','deductibleContributions'],['special','specialDeduction'],['other','otherDeduction'],['adjustment','taxableAdjustment']])$(`tax-a-${n}-${k}`).value=row[source];$(`tax-a-${n}-reduced`).checked=$('tax-annual-reduced').checked;$(`tax-a-${n}-predicted`).checked=row.predicted;}
 monthlyPrepared=true;return true;
}
for(const event of ['input','change'])$('tax-input').addEventListener(event,event=>{
 const id=event.target.id;if(!id||(event.target.closest('.choices')&&!event.target.matches('select')))return;
 if(id==='tax-bonus')bonusEntry='amount';else if(id==='tax-bonus-months')bonusEntry='months';if(['tax-salary','tax-bonus','tax-bonus-months'].includes(id))syncBonus();
 if(id==='tax-period'){const [y,m]=value(id).split('-');if(value('tax-year')!==y){basicDeduction.reset();annualDeduction.reset();$('tax-firstConfirmed').checked=false;states.bonus={};states.annual={};}$('tax-year').value=y||'';$('tax-month').value=String(Number(m)||'');}
 if(id==='tax-year'){basicDeduction.reset();annualDeduction.reset();$('tax-firstConfirmed').checked=false;const m=value('tax-month');$('tax-period').value=`${value(id)}-${String(m).padStart(2,'0')}`;for(const key of Object.keys(states))if(key!==task)states[key]={};}
 if(['tax-period','tax-year'].includes(id))for(const prefix of ['tax','tax-annual'])syncHousingDefault(prefix);
 if(id==='tax-annual-mode'&&value(id)==='monthly'&&!monthlyPrepared&&value('tax-salary').trim())fillMonths(false,true);
 if(id.startsWith('tax-a-'))monthlyPrepared=true;
 visibility();invalidate();
});
for(const id of ['tax-run','tax-bonus-run','tax-annual-run'])$(id).onclick=run;
$('tax-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!event.target.closest('.choices')&&event.target.matches('input:not([type=checkbox])')){event.preventDefault();run();}});
$('tax-edit-employment').onclick=()=>{$('tax-employment').open=true;$('tax-startMonth').focus({preventScroll:true});};
$('tax-check').onclick=()=>{$('tax-mode').value=value('tax-mode')==='actual'?'quick':'actual';invalidate();visibility();if(!$('tax-previous').hidden)$('tax-previous').open=true;};
$('tax-annual-fill').onclick=()=>{if(fillMonths(true)){invalidate();visibility();}};
$('tax-use-wage').onclick=()=>{
 try{
  syncAnnualInputs();let annual=states.annual.result;
  if(!annual){if(value('tax-annual-mode')==='monthly')annual=calculateAnnual(annualInput());else {if(value('tax-mode')==='actual')fail('tax.easeNoEstimate','tax-use-wage');const previous=task;let input;try{task='wage';input=read();}finally{task=previous;}const months=wageMonths(input);const unavailable=months.find(m=>m.unavailable);if(unavailable)fail(unavailable.unavailable,'tax-city-control',unavailable.params);annual=calculateAnnual({year:value('tax-year'),months,annualSpecialDeduction:value('tax-annualSpecialDeduction'),medicalDeduction:value('tax-medicalDeduction')});}}
  if(financialDraft($('tax-baseline'))!==initialBonusBasis&&!confirm(t('payroll.annualFillConfirm')))return;
  const basis=annualBasisForBonus(annual);for(const [key,value]of Object.entries(basis))$('tax-bonusAnnual'+({salary:'Salary',contributions:'Contributions',special:'Special',other:'Other',medical:'Medical',adjustment:'Adjustment'}[key])).value=value;
  invalidate();
 }catch(error){showError(error,{field:fieldFor(error,'bonus'),focus:true});}
};
addEventListener('hashchange',()=>chooseTask(location.hash.slice(1)));queueMicrotask(()=>chooseTask(location.hash.slice(1)));
attachExports('tax',()=>rows,()=>({year:value('tax-year'),wage:states.wage.result?.conditions,payment:resultPayment?.conditions,contributionRates:resultPayment?.items.map(({id,employeeRate,employerRate})=>({id,employeeRate,employerRate})),refundEligible:unified?.refund!=null,currentMonth:displayedWage?{predicted:states.wage.input?.predicted??false,...wageComputation(displayedWage),salary:displayedWage.salary,contributions:displayedWage.contributions,currentTax:displayedWage.currentTax,net:displayedWage.net}:null,bonus:states.bonus.result?.conditions,annual:states.annual.result?.conditions,summary:unified?.conditions,partial:Object.entries(states).filter(([,s])=>s.error).map(([scope,s])=>({scope,code:s.error.code}))}),()=>[...(unified?.months||states.annual.result?.months||states.wage.months||[]),...(breakdowns?payrollBreakdownRows(breakdowns):[])]);
onLanguageChange(()=>{syncBonus();visibility();render();});for(const prefix of ['tax','tax-annual'])syncHousingDefault(prefix);syncBonus();visibility();chooseTask(task);translateDOM($('tax-input'));
const initialDraft=financialDraft($('tax-input')),initialBonusBasis=financialDraft($('tax-baseline'));registerContentCheck(()=>Boolean(monthlyPrepared||assistants.some(a=>a.hasDraft())||Object.values(states).some(state=>state.result)||financialDraft($('tax-input'))!==initialDraft));
