import {t,language} from '../../i18n-runtime.js';
import {D} from './money.js';
import {formatMoney} from './ui.js';
import {chartCopy} from './breakdown-copy.js';
import './breakdown.css';
export {buildPayrollBreakdowns} from './breakdown-model.js';

function localized(breakdowns){
 if(!breakdowns)return [];
 const copy=chartCopy[language()]??chartCopy.en,unknown=t('payroll.unknown');
 const label=keys=>keys.split('+').map(key=>t(key)).join(' + ');
 const percent=new Intl.NumberFormat(language(),{style:'percent',maximumFractionDigits:2});
 const percentage=value=>{
  if(value===null)return '';
  const share=new D(value).div(100);
  return share.gt(0)&&share.lt('0.0001')?'<'+percent.format('0.0001'):percent.format(share.toString());
 };
 return [breakdowns.personal,breakdowns.employer].map(group=>({...group,
  title:copy[group.id==='personal'?0:1],note:copy[2],
  base:{item:label(group.baseLabel),amount:group.total??unknown,percentage:percentage(group.status==='complete'?'100':null)},
  rows:group.rows.map(row=>({...row,item:label(row.label),note:row.note?t(row.note):'',
   value:row.amount??unknown,percentage:percentage(row.percent)}))
 }));
}
export function payrollBreakdownRows(breakdowns){
 return localized(breakdowns).flatMap(group=>[{group:group.title,...group.base},...group.rows.map(row=>({
  group:group.title,item:row.item,amount:row.value,percentage:row.percentage
 }))]);
}

const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const svgElement=tag=>document.createElementNS('http://www.w3.org/2000/svg',tag);
function ring(rows){
 const svg=svgElement('svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 let offset=new D(0);
 for(const row of rows){
  const size=new D(row.percent);if(size.isZero())continue;
  const arc=svgElement('circle');arc.setAttribute('data-piece',row.id);
  for(const [key,value] of Object.entries({cx:50,cy:50,r:40,pathLength:100,transform:'rotate(-90 50 50)','stroke-dasharray':size.toFixed(8)+' 100','stroke-dashoffset':offset.negated().toFixed(8)}))arc.setAttribute(key,value);
  svg.append(arc);offset=offset.plus(size);
 }
 return svg;
}
function card(group){
 const section=element('section');section.className='payroll-breakdown';section.dataset.breakdown=group.id;section.dataset.status=group.status;
 section.tabIndex=0;section.setAttribute('aria-label',group.title);
 const overview=element('div'),summary=element('div'),title=element('h3',group.title),base=element('p',group.base.item);
 overview.className='breakdown-overview';const amount=element('bdi',group.total===null?group.base.amount:formatMoney(group.total));
 amount.className='breakdown-total';if(group.total!==null)amount.dir='ltr';summary.append(title,base,amount);overview.append(summary);
 if(group.status==='complete')overview.append(ring(group.rows));
 section.append(overview);
 if(group.status!=='complete'){const note=element('p',group.note);note.className='breakdown-note';section.append(note);}
 const table=element('table'),head=element('thead'),headers=element('tr'),body=element('tbody');table.setAttribute('aria-label',group.title);
 for(const name of [t('payroll128.item'),t('money.amount')+' (CNY)',t('calculator.share')]){
  const th=element('th',name);th.scope='col';headers.append(th);
 }
 head.append(headers);table.append(head,body);
 for(const row of group.rows){
  const tr=element('tr'),th=element('th'),key=element('span'),dot=element('span');
  tr.dataset.breakdownItem=row.id;th.scope='row';key.className='breakdown-key';dot.className='breakdown-dot';dot.dataset.piece=row.id;dot.setAttribute('aria-hidden','true');
  if(group.status==='complete')key.append(dot);key.append(element('span',row.item));th.append(key);
  if(row.note){const note=element('small',row.note);th.append(note);}
  const amount=element('td'),value=element('bdi',row.amount===null?row.value:formatMoney(row.amount)),share=element('td'),ratio=element('bdi',row.percentage||'—');
  if(row.amount!==null)value.dir='ltr';ratio.dir='ltr';amount.append(value);share.append(ratio);tr.append(th,amount,share);body.append(tr);
 }
 section.append(table);return section;
}
export function renderPayrollBreakdowns(container,breakdowns){
 container.classList.add('payroll-breakdowns');
 container.replaceChildren(...localized(breakdowns).map(card));
}
