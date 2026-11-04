import {D,amount,fixed,sum,fail} from './money.js';

const brackets=[['36000','.03','0'],['144000','.10','2520'],['300000','.20','16920'],['420000','.25','31920'],['660000','.30','52920'],['960000','.35','85920'],[null,'.45','181920']];
const bonusBrackets=[['3000','.03','0'],['12000','.10','210'],['25000','.20','1410'],['35000','.25','2660'],['55000','.30','4410'],['80000','.35','7160'],[null,'.45','15160']];
export function taxOn(value){
 const taxable=D.max(new D(value),0),[,r,quick]=brackets.find(([limit])=>limit===null||taxable.lte(limit));
 return {tax:fixed(D.max(taxable.mul(r).minus(quick),0)),rate:r,quick:fixed(quick),taxable:fixed(taxable)};
}
function period(input){const month=Number(input.month),start=Number(input.startMonth??1);if(!Number.isInteger(month)||!Number.isInteger(start)||start<1||month>12||start>month)fail('tax.monthRange','startMonth');return {month,start,n:month-start+1};}
export function calculateWage(input){
 const {month,start,n}=period(input),salary=amount(input.salary,'salary'),cash=amount(input.contributions,'contributions',0),deductible=amount(input.deductibleContributions,'deductibleContributions',cash),special=amount(input.specialDeduction,'specialDeduction',0),other=amount(input.otherDeduction,'otherDeduction',0),adjustment=amount(input.taxableAdjustment,'taxableAdjustment',0),actual=input.mode==='actual';
 if(deductible.gt(cash))fail('insurance.deductibleRange','deductibleContributions');
 if(actual&&n>1&&!input.previous)fail('tax.previousRequired','previousIncome');
 const previous=input.previous||{};
 const basic=new D(5000).mul(input.firstEmployment?month:n),cumulativeIncome=actual?amount(previous.income,'previousIncome',0).plus(salary):salary.mul(n);
 const cumulativeDeductible=actual?amount(previous.contributions,'previousContributions',0).plus(deductible):deductible.mul(n);
 const cumulativeSpecial=actual?amount(previous.special,'previousSpecial',0).plus(special):special.mul(n),cumulativeOther=actual?amount(previous.other,'previousOther',0).plus(other):other.mul(n);
 const cumulativeAdjustment=actual?amount(previous.adjustment,'previousAdjustment',0).plus(adjustment):adjustment.mul(n);
 const basicUsed=actual?amount(previous.basic,'previousBasic',n===1?0:new D(5000).mul(input.firstEmployment?month-1:n-1)).plus(input.firstEmployment&&n===1?new D(5000).mul(month):5000):basic;
 const taxable=D.max(cumulativeIncome.plus(cumulativeAdjustment).minus(cumulativeDeductible).minus(cumulativeSpecial).minus(cumulativeOther).minus(basicUsed),0),tax=taxOn(taxable);
 const previousTax=actual?amount(previous.withheld,'previousWithheld',0):new D(taxOn(salary.plus(adjustment).minus(deductible).minus(special).minus(other).mul(n-1).minus(new D(5000).mul(input.firstEmployment?month-1:n-1))).tax);
 const currentTax=D.max(new D(tax.tax).minus(previousTax),0);
 return {currentTax:fixed(currentTax),net:fixed(salary.minus(cash).minus(currentTax)),cumulativeIncome:fixed(cumulativeIncome),cumulativeTax:tax.tax,cumulativeTaxable:fixed(taxable),basicDeduction:fixed(basicUsed),rate:tax.rate,quick:tax.quick,previousWithheld:fixed(previousTax),conditions:{...input,startMonth:start,month}};
}
// Resolve each covered month independently; a missing rule must not be replaced
// with the current month's contribution amount.
export function calculateWageWithPolicy(input,contributionForMonth){
 const {start,month}=period(input);let previous={income:'0',contributions:'0',special:'0',other:'0',adjustment:'0',basic:'0',withheld:'0'},result;const policies=[];
 for(let n=start;n<=month;n++){
  const c=contributionForMonth(n);policies.push(c.conditions);
  result=calculateWage({...input,mode:'actual',month:n,contributions:c.employeeTotal,deductibleContributions:c.taxDeductible,taxableAdjustment:c.taxableAdjustment,previous});
  previous={income:result.cumulativeIncome,contributions:fixed(new D(previous.contributions).plus(c.taxDeductible)),special:fixed(new D(previous.special).plus(amount(input.specialDeduction,'specialDeduction',0))),other:fixed(new D(previous.other).plus(amount(input.otherDeduction,'otherDeduction',0))),adjustment:fixed(new D(previous.adjustment).plus(c.taxableAdjustment)),basic:result.basicDeduction,withheld:fixed(new D(previous.withheld).plus(result.currentTax))};
 }
 return {...result,conditions:{...input,policies}};
}
export function calculateBonus(input){
 const year=Number(input.year);if(!Number.isInteger(year)||year<2026||year>2027)fail('tax.bonusExpired','year');
 const bonus=amount(input.bonus,'bonus'),monthly=bonus.div(12),[,r,quick]=bonusBrackets.find(([limit])=>limit===null||monthly.lte(limit));
 const separate=new D(fixed(D.max(bonus.mul(r).minus(quick),0))),hasBaseline=Boolean(input.annualBasis)||(input.annualTaxable!==undefined&&input.annualTaxable!=='');
 const basis=input.annualBasis,baseline=basis?amount(basis.salary,'bonusAnnualSalary').minus(60000).minus(amount(basis.contributions,'bonusAnnualContributions',0)).minus(amount(basis.special,'bonusAnnualSpecial',0)).minus(amount(basis.other,'bonusAnnualOther',0)).minus(amount(basis.medical,'bonusAnnualMedical',0)):hasBaseline?amount(input.annualTaxable,'annualTaxable'):null,separateTotal=baseline?new D(taxOn(baseline).tax).plus(separate):null,combinedTotal=baseline?new D(taxOn(baseline.plus(bonus)).tax):null;
 const cliff=brackets.slice(0,-1).map(([limit])=>new D(limit)).find(limit=>bonus.gt(limit)&&bonus.minus(separate).lt(limit.minus(calculateBonus({year,bonus:limit.toString()}).separateTax)));
 return {separateTax:fixed(separate),bonusNet:fixed(bonus.minus(separate)),rate:r,quick:fixed(quick),salaryBalance:baseline&&fixed(baseline),separateTotal:separateTotal&&fixed(separateTotal),combinedTotal:combinedTotal&&fixed(combinedTotal),saving:separateTotal&&fixed(separateTotal.minus(combinedTotal).abs()),preferred:separateTotal===null?null:separateTotal.eq(combinedTotal)?'equal':separateTotal.lt(combinedTotal)?'separate':'combined',cliff:cliff?.toString()??null,conditions:{...input}};
}
export function calculateAnnual(input){
 const year=Number(input.year);if(!Number.isInteger(year)||year<2026||year>9999)fail('tax.year','year');
 if(!Array.isArray(input.months)||!input.months.length||input.months.length>12)fail('tax.monthRange','months');
 const seen=new Set(),months=[],acc={income:new D(0),contributions:new D(0),special:new D(0),other:new D(0),adjustment:new D(0),basic:new D(0),withheld:new D(0)};
 for(const row of [...input.months].sort((a,b)=>a.month-b.month)){
  const month=Number(row.month);if(!Number.isInteger(month)||month<1||month>12||seen.has(month))fail('tax.duplicateMonth','months');seen.add(month);
  const salary=amount(row.salary,`salary-${month}`),cash=amount(row.contributions,`contributions-${month}`,0),deductible=amount(row.deductibleContributions,`deductible-${month}`,cash),special=amount(row.specialDeduction,`special-${month}`,0),other=amount(row.otherDeduction,`other-${month}`,0),adjustment=amount(row.taxableAdjustment,`adjustment-${month}`,0);
  if(deductible.gt(cash))fail('insurance.deductibleRange',`deductible-${month}`);
  acc.income=acc.income.plus(salary);acc.contributions=acc.contributions.plus(deductible);acc.special=acc.special.plus(special);acc.other=acc.other.plus(other);acc.adjustment=acc.adjustment.plus(adjustment);acc.basic=acc.basic.plus(5000);
  const tax=taxOn(acc.income.plus(acc.adjustment).minus(acc.contributions).minus(acc.special).minus(acc.other).minus(acc.basic)),withheld=D.max(new D(tax.tax).minus(acc.withheld),0);acc.withheld=acc.withheld.plus(withheld);
  months.push({...row,salary:fixed(salary),contributions:fixed(cash),deductibleContributions:fixed(deductible),specialDeduction:fixed(special),withheld:fixed(withheld),net:fixed(salary.minus(cash).minus(withheld))});
 }
 const annualTax=taxOn(acc.income.plus(acc.adjustment).minus(acc.contributions).minus(acc.special).minus(acc.other).minus(60000).minus(amount(input.medicalDeduction,'medicalDeduction',0)));
 const actual=input.actualWithheld===undefined||input.actualWithheld===''?null:amount(input.actualWithheld,'actualWithheld');
 const cash=sum(months.map(m=>m.contributions));
 return {months,gross:fixed(acc.income),contributions:fixed(cash),annualTax:annualTax.tax,predictedWithheld:fixed(acc.withheld),actualWithheld:actual&&fixed(actual),refund:actual&&fixed(actual.minus(annualTax.tax)),cashAfterAnnualTax:fixed(acc.income.minus(cash).minus(annualTax.tax)),annualTaxable:annualTax.taxable,conditions:{...input}};
}
