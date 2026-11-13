import {D,amount,fixed,sum,fail} from './money.js';

// UI adapters keep calendar-month inputs separate from one-off annual deductions.
export function sameSalaryMonths(input,currentMonth){
 const salary=amount(input.salary,'annual-salary'),cash=amount(input.contributions,'annual-contributions');
 const deductible=amount(input.deductibleContributions,'annual-deductible',cash);
 return Array.from({length:12},(_,i)=>({month:i+1,predicted:i+1>currentMonth,salary:fixed(salary),contributions:fixed(cash),deductibleContributions:fixed(deductible),specialDeduction:input.specialDeduction||'0',otherDeduction:input.otherDeduction||'0',taxableAdjustment:input.taxableAdjustment||'0'}));
}
export function deductionDraft(input={}){
 const child=(key,share)=>{const count=String(input[key]??'0');if(!/^\d+$/.test(count)||!Number.isSafeInteger(Number(count)))fail('tax.easeChildCount',key);const part=String(input[share]??'1');if(!['1','.5'].includes(part))fail('tax.easeInvalidChoice',share);return fixed(new D(count).mul(2000).mul(part));};
 if(!['none','only','shared'].includes(input.elderly||'none'))fail('tax.easeInvalidChoice','elderly');
 const elderly=input.elderly==='only'?new D(3000):input.elderly==='shared'?amount(input.elderlyShare,'elderlyShare',0):new D(0);
 if(input.elderly==='shared'&&elderly.gt(1500))fail('tax.easeElderlyLimit','elderlyShare');
 const housing={none:['0','0'],rent1500:['1500','0'],rent1100:['1100','0'],rent800:['800','0'],mortgage1000:['0','1000'],mortgage500:['0','500']}[input.housing||'none'];
 if(!housing)fail('tax.easeInvalidChoice','housing');
 const result={children:child('children','childShare'),infant:child('infant','infantShare'),elderly:fixed(elderly),rent:fixed(housing[0]),mortgage:fixed(housing[1]),education:input.education?'400.00':'0.00'};
 return {...result,total:sum(Object.values(result).map(v=>new D(v))).toFixed(2)};
}

// Ordinary estimates guard cash entries; exceptional payroll deductions stay explicit.
export function manualWagePayment(input){
 const salary=amount(input.salary,'salary'),cash=amount(input.contributions,'contributions'),limit=input.limit===undefined?null:amount(input.limit,'contributions');
 if(!input.exception&&(cash.gt(salary)||limit&&cash.gt(limit)))fail('tax.paymentRange','contributions');
 const deductible=input.exception?amount(input.deductibleContributions,'deductibleContributions'):amount(input.deductibleContributions,'deductibleContributions',cash);
 if(deductible.gt(cash))fail('insurance.deductibleRange','deductibleContributions');
 if(limit&&deductible.gt(limit))fail('tax.deductionRange','deductibleContributions');
 return {contributions:fixed(cash),deductibleContributions:fixed(deductible)};
}
