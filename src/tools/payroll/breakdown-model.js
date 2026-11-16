import {D,fixed,sum} from './money.js';

// These are calculation outputs (including signed cash balances), not form inputs.
const money=value=>/^-?\d+(?:\.\d{1,2})?$/.test(value)?fixed(value):null;
const line=(id,label,value,note=null)=>({id,label,amount:money(value),note});
function componentRows(items,side,total){
 if(!items?.length)return [line(side+'Total','payroll.'+side+'Total',total)];
 return items.map(item=>line(item.id,'payroll.item_'+item.id,item[side+'Amount'],
  item.excluded?'insuranceEase.excluded':item.mergedInto?'payroll.merged':null));
}
function section(id,baseLabel,total,rows,consistent=true){
 const partial=total===null||rows.some(row=>row.amount===null);
 const complete=!partial&&consistent&&new D(total).gt(0)&&rows.every(row=>new D(row.amount).gte(0))&&sum(rows.map(row=>row.amount)).eq(total);
 return {id,baseLabel,total,status:complete?'complete':partial?'partial':'amounts-only',
  rows:rows.map(row=>({...row,percent:complete?new D(row.amount).mul(100).div(total).toString():null}))};
}

export function buildPayrollBreakdowns({gross,grossLabel='payroll.salary',net,tax,employeeTotal,contributions}){
 const salary=money(gross),employee=money(employeeTotal??contributions?.employeeTotal),employer=money(contributions?.employerTotal);
 const employeeRows=componentRows(contributions?.items,'employee',employee),employerRows=componentRows(contributions?.items,'employer',employer);
 const beforeTax=tax===null;
 const cash=beforeTax?(net??contributions?.cashBeforeTax??(salary!==null&&employee!==null?fixed(new D(salary).minus(employee)):null)):net;
 const personal=[line(beforeTax?'beforeTax':'net',beforeTax?'payroll.beforeTax':'payroll.net',cash)];
 if(!beforeTax)personal.push(line('tax','payroll.currentTax',tax));
 personal.push(...employeeRows);
 const employeeMatches=employee!==null&&employeeRows.every(row=>row.amount!==null)&&sum(employeeRows.map(row=>row.amount)).eq(employee);
 const cost=salary!==null&&employer!==null?fixed(new D(salary).plus(employer)):null;
 return {
  personal:section('personal',grossLabel,salary,personal,employeeMatches),
  employer:section('employer','payroll.companyCost',cost,[line('gross',grossLabel,salary),...employerRows])
 };
}
