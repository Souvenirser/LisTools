import catalog from './cities.json' with {type:'json'};
import reference from './reference-cities.json' with {type:'json'};
import {monthParts,fail} from './money.js';

export const cities=catalog.cities;
export const policyVersion=catalog.version;
// A source-site estimate is a snapshot, never an official effective-date policy.
export function resolveReferencePolicy(cityId,month){
 monthParts(month);const city=cities.find(item=>item.id===cityId),data=reference.cities.find(item=>item.id===cityId);if(!city||!data)fail('insurance.choose','city');
 const sources=[{title:reference.source.title,url:data.sourceUrl,sha256:data.sourceSha256},reference.source],items=['pension','medical','unemployment','maternity','injury','housing'].map(id=>({
  id,min:data.min,max:data.max,employee:id==='housing'?'0.07':data.employee[id],employer:id==='housing'?'0.07':data.employer[id],employeeFixed:'0',employerFixed:'0',
  digits:2,rounding:'half-up',deductible:true,verified:false,verification:'reference',reference:true,sources,
  ...(id==='housing'?{rateMin:'0.05',rateMax:'0.12'}:{}),...(id==='injury'?{estimated:true}:{})
 }));
 return {cityId,cityName:city.name,month,custom:false,reference:true,referenceAsOf:reference.capturedAt,items,sources,version:reference.version};
}
function periodRule(city,id,month,profile){
 const rule=city.periods.flatMap(p=>p.items).find(item=>item.id===id&&item.from<=month&&item.to>=month);
 if(!rule)return null;
 const result={...rule,verified:rule.verification==='verified'};
 if(id==='medical'&&rule.tiers){const tier=rule.tiers[Number(profile.tier||0)];if(!tier)fail('insurance.choose','tier');Object.assign(result,tier);}
 if(id==='medical'&&rule.fixedByMonth)result.employeeFixed=rule.fixedByMonth[String(Number(month.slice(5)))];
 if(id==='pension'&&city.needsHukou&&profile.hukou&&result.employer!==null)result.employer=String(Number(result.employer)+.01);
 return result;
}
export function resolvePolicy(cityId,month,profile={}){
 monthParts(month);const city=cities.find(item=>item.id===cityId);if(!city)fail('insurance.choose','city');
 const items=['pension','medical','unemployment','maternity','injury','housing'].map(id=>{
  const result=periodRule(city,id,month,profile);if(!result)fail('tax.policyMissing','month',{item:id});return result;
 });
 return {cityId,cityName:city.name,month,custom:false,items,sources:[...new Map(items.flatMap(i=>i.sources).map(s=>[s.url,s])).values()],version:policyVersion};
}

// UI estimates prefer dated component rules; a reference is never official verification.
// Resolve components independently so a missing social period cannot discard housing limits.
export function resolveEstimatePolicy(cityId,month,profile={}){
 const fallback=resolveReferencePolicy(cityId,month),city=cities.find(item=>item.id===cityId);
 const items=fallback.items.map(base=>{
  const rule=periodRule(city,base.id,month,profile);if(!rule)return base;
  if(rule.verified)return rule;
  const usable=rule.verification==='reference'&&rule.employee!==null&&rule.employee!==undefined&&(rule.mergedInto||rule.id==='injury'||rule.min!==null&&rule.max!==null);
  return usable?{...rule,verified:false,reference:true}:base;
 });
 const usesReference=items.some(item=>item.reference);
 return {...fallback,items,reference:usesReference,version:policyVersion,sources:[...new Map(items.flatMap(item=>item.sources||[]).map(source=>[source.url,source])).values()]};
}
