import {D,amount,fixed,sum,fail} from './money.js';
import {calculateAnnual,calculateBonus,calculateWage,wageComputation} from './tax.js';

// Compose existing calculation results; calendar timing never changes annual deductions.
export function annualBasisForBonus(annual){
 const total=key=>sum(annual.months.map(row=>amount(row[key],key,0)));
 return {salary:annual.gross,contributions:fixed(total('deductibleContributions')),special:fixed(total('specialDeduction').plus(amount(annual.conditions.annualSpecialDeduction,'annualSpecialDeduction',0))),other:fixed(total('otherDeduction')),medical:fixed(amount(annual.conditions.medicalDeduction,'medicalDeduction',0)),adjustment:fixed(total('taxableAdjustment'))};
}

export function combinePayrollResults({annual,bonus=null,method='separate',bonusMonth='',bonusActualWithheld='',wageConditions=null}){
 if(!['separate','combined'].includes(method))fail('office.error','tax-bonus-method');
 const hasBonus=Boolean(bonus),bonusAmount=hasBonus?amount(bonus.conditions.bonus,'bonus'):new D(0),hasMonth=String(bonusMonth).trim()!=='';
 if(hasBonus&&hasMonth&&(!Number.isInteger(Number(bonusMonth))||!annual.months.some(row=>Number(row.month)===Number(bonusMonth))))fail('tax.monthRange','tax-bonusMonth');
 const comparison=hasBonus?calculateBonus({...bonus.conditions,annualBasis:annualBasisForBonus(annual)}):null;
 const totalTax=new D(!hasBonus?annual.annualTax:method==='combined'?comparison.combinedTotal:comparison.separateTotal);
 let calculated=annual.months;
 if(hasBonus&&method==='combined'&&hasMonth){
  const adjusted=annual.months.map(row=>({...row,salary:fixed(new D(row.salary).plus(Number(row.month)===Number(bonusMonth)?bonusAmount:0))}));
  if(wageConditions){
   let previous={income:'0',contributions:'0',special:'0',other:'0',adjustment:'0',basic:'0',withheld:'0'};
   calculated=adjusted.map(row=>{
    const r=calculateWage({...wageConditions,...row,mode:'actual',previous});
    previous={income:r.cumulativeIncome,contributions:fixed(new D(previous.contributions).plus(row.deductibleContributions)),special:fixed(new D(previous.special).plus(row.specialDeduction||0)),other:fixed(new D(previous.other).plus(row.otherDeduction||0)),adjustment:fixed(new D(previous.adjustment).plus(row.taxableAdjustment||0)),basic:r.basicDeduction,withheld:fixed(new D(previous.withheld).plus(r.currentTax))};
    return {...row,withheld:r.currentTax,computation:wageComputation(r)};
   });
  }else calculated=calculateAnnual({...annual.conditions,actualWithheld:'',months:adjusted}).months;
 }
 const months=annual.months.map((row,index)=>{
  const paid=hasBonus&&hasMonth&&Number(row.month)===Number(bonusMonth),extra=paid?bonusAmount:new D(0),bonusTax=paid&&method==='separate'?new D(comparison.separateTax):new D(0),withheld=calculated[index].withheld;
  return {...row,computation:calculated[index].computation,withheld,net:fixed(new D(row.salary).minus(row.contributions).minus(withheld)),bonus:fixed(extra),bonusTax:fixed(bonusTax),totalWithheld:fixed(new D(withheld).plus(bonusTax)),totalNet:fixed(new D(row.salary).plus(extra).minus(row.contributions).minus(withheld).minus(bonusTax))};
 });
 const actual=annual.actualWithheld===null||hasBonus&&String(bonusActualWithheld).trim()===''?null:new D(annual.actualWithheld).plus(hasBonus?amount(bonusActualWithheld,'tax-bonusWithheld'):0);
 return {gross:annual.gross,contributions:annual.contributions,bonus:fixed(bonusAmount),totalIncome:fixed(new D(annual.gross).plus(bonusAmount)),totalAnnualTax:fixed(totalTax),annualNet:fixed(new D(annual.gross).plus(bonusAmount).minus(annual.contributions).minus(totalTax)),comparison,method,months,unallocatedBonus:hasBonus&&!hasMonth,refund:actual!==null&&months.length===12&&!months.some(row=>row.predicted)?fixed(actual.minus(totalTax)):null,conditions:{annual:annual.conditions,bonus:bonus?.conditions??null,bonusMonth:hasMonth?Number(bonusMonth):null,method,bonusActualWithheld:bonusActualWithheld||null}};
}
