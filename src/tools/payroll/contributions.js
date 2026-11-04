import {D,amount,rate,fixed,sum,fail} from './money.js';

export function calculateContributions(input,policy){
 const salary=amount(input.salary,'salary'),items=[],excluded=new Set(input.excluded||[]);
 for(const rule of policy.items){
  const id=rule.id,skip=excluded.has(id)||Boolean(rule.mergedInto);
  if(!skip&&!policy.custom&&rule.verified!==true)fail('insurance.unverified',`base-${id}`,{item:id});
  let base=skip?new D(0):input.mode==='actual'?amount(input.bases?.[id]??input.base,`base-${id}`):salary;
  const min=rule.min===null||rule.min===undefined?null:new D(rule.min),max=rule.max===null||rule.max===undefined?null:new D(rule.max);
  if(!skip){
   if(input.mode==='actual'&&!policy.custom&&((min&&base.lt(min))||(max&&base.gt(max))))fail('insurance.baseRange',`base-${id}`,{min:min?.toString()??'0',max:max?.toString()??'∞'});
   if(input.mode!=='actual'){if(min)base=D.max(base,min);if(max)base=D.min(base,max);}
  }
  const rounding={ 'half-up':D.ROUND_HALF_UP,down:D.ROUND_DOWN,up:D.ROUND_UP }[rule.rounding];
  if(rounding===undefined||![0,2].includes(rule.digits))fail('insurance.unverified',`base-${id}`,{item:id});
  const rates={};
  for(const side of ['employee','employer']){
   const override=input.rates?.[id]?.[side],value=override===undefined?rule[side]:override;rates[side]=value===null?null:rate(value,`${side}-${id}`);
   if(!skip&&!policy.custom&&id!=='housing'&&id!=='supplemental'&&!(id==='injury'&&side==='employer')&&input.rates?.[id]?.[side]!==undefined&&rates[side]&&!rates[side].eq(rule[side]))fail('insurance.rateRange',`${side}-${id}`);
   if(!skip&&id==='housing'&&rates[side]&&((rule.rateMin&&rates[side].lt(rule.rateMin))||(rule.rateMax&&rates[side].gt(rule.rateMax))))fail('insurance.rateRange',`${side}-${id}`,{min:rule.rateMin,max:rule.rateMax});
  }
  const charge=side=>{
   if(skip)return '0.00';if(rates[side]===null)return null;
   const extra=amount(rule[side+'Fixed'],`${side}-${id}`,0);
   if(rule.frequency==='annual'&&!rule.chargeMonth)fail('insurance.unverified',`base-${id}`,{item:id});
   const fixedDue=rule.frequency==='annual'&&Number(policy.month?.slice(5))!==rule.chargeMonth?new D(0):extra;
   return fixed(base.mul(rates[side]).plus(fixedDue).toDecimalPlaces(rule.digits,rounding));
  };
  items.push({id,base:fixed(base),employeeRate:rates.employee?.toString()??null,employerRate:rates.employer?.toString()??null,employeeFixed:rule.employeeFixed||'0',employerFixed:rule.employerFixed||'0',employeeAmount:charge('employee'),employerAmount:charge('employer'),mergedInto:rule.mergedInto||null,excluded:excluded.has(id),deductible:rule.deductible!==false,estimated:rule.estimated===true});
 }
 if(items.some(i=>i.employeeAmount===null))fail('insurance.unverified','salary');
 const employeeTotal=sum(items.map(i=>i.employeeAmount)),companyKnown=items.every(i=>i.employerAmount!==null),employerTotal=companyKnown?sum(items.map(i=>i.employerAmount)):null;
 const housing=items.filter(i=>['housing','supplemental'].includes(i.id)),housingKnown=housing.every(i=>i.employerAmount!==null);
 const deductible=policy.custom?(input.deductible===undefined||input.deductible===''?null:amount(input.deductible,'deductible')):sum(items.filter(i=>i.deductible).map(i=>i.employeeAmount));
 if(deductible&&deductible.gt(employeeTotal))fail('insurance.deductibleRange','deductible');
 return {items,employeeTotal:fixed(employeeTotal),employerTotal:employerTotal&&fixed(employerTotal),housingCredit:housingKnown?fixed(sum(housing.flatMap(i=>[i.employeeAmount,i.employerAmount]))):null,employeeSocial:fixed(sum(items.filter(i=>!housing.includes(i)).map(i=>i.employeeAmount))),employeeHousing:fixed(sum(housing.map(i=>i.employeeAmount))),cashBeforeTax:fixed(salary.minus(employeeTotal)),companyCost:employerTotal&&fixed(salary.plus(employerTotal)),taxDeductible:deductible&&fixed(deductible),taxableAdjustment:policy.custom?(input.taxableAdjustment===undefined||input.taxableAdjustment===''?null:fixed(amount(input.taxableAdjustment,'taxableAdjustment'))):'0.00',conditions:{...input,cityId:policy.cityId,cityName:policy.cityName,month:policy.month,policyVersion:policy.version,custom:policy.custom,sources:policy.sources||[]}};
}
