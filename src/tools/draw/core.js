import Papa from 'papaparse';
const fail=code=>{throw Object.assign(new Error(code),{code:`draw.${code}`});};
const word=()=>crypto.getRandomValues(new Uint32Array(1))[0];
export const entries=text=>text.split(/\r\n|\r|\n/).map(value=>value.trim()).filter(Boolean);
export function randomInteger(range,random=word) {
 if(!Number.isInteger(range)||range<1||range>2**32) fail('invalidRange');
 const limit=2**32-(2**32%range);let value;
 do {value=random();} while(value>=limit);
 return value%range;
}
export function shuffle(values,random=word) {
 const result=[...values];
 for(let i=result.length-1;i>0;i--) {const at=randomInteger(i+1,random);[result[i],result[at]]=[result[at],result[i]];}
 return result;
}
function count(value,max) {if(!Number.isInteger(value)||value<1||value>max||value>100000) fail('invalidCount');}
export function sample(values,amount,random=word) {count(amount,values.length);return shuffle(values,random).slice(0,amount);}
export function group(values,amount,mode='groups',random=word) {
 count(amount,values.length);const shuffled=shuffle(values,random),groups=[];
 const total=mode==='members'?Math.ceil(values.length/amount):amount;
 let at=0;
 for(let i=0;i<total;i++) {const size=mode==='members'?amount:Math.floor(values.length/total)+(i<values.length%total?1:0);groups.push(shuffled.slice(at,at+size));at+=size;}
 return groups;
}
export function integers(min,max,amount,repeat=false,random=word) {
 const range=max-min+1;
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||range<1||range>2**32) fail('invalidRange');
 count(amount,repeat?100000:range);
 const result=[],swaps=new Map();
 for(let i=0;i<amount;i++) {
  if(repeat) result.push(min+randomInteger(range,random));
  else {const at=i+randomInteger(range-i,random),value=swaps.get(at)??at;swaps.set(at,swaps.get(i)??i);result.push(min+value);}
 }
 return result;
}
export const csv=rows=>Papa.unparse(rows,{escapeFormulae:true});
