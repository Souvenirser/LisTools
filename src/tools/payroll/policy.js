import catalog from './cities.json' with {type:'json'};
import {monthParts,fail} from './money.js';

export const cities=catalog.cities;
export const policyVersion=catalog.version;
export function resolvePolicy(cityId,month,profile={}){
 monthParts(month);const city=cities.find(item=>item.id===cityId);if(!city)fail('insurance.choose','city');
 const items=['pension','medical','unemployment','maternity','injury','housing'].map(id=>{
  const rule=city.periods.flatMap(p=>p.items).find(item=>item.id===id&&item.from<=month&&item.to>=month);
  if(!rule)fail('tax.policyMissing','month',{item:id});
  const result={...rule,verified:rule.verification==='verified'};
  if(id==='medical'&&rule.tiers){const tier=rule.tiers[Number(profile.tier||0)];if(!tier)fail('insurance.choose','tier');Object.assign(result,tier);}
  if(id==='medical'&&rule.fixedByMonth)result.employeeFixed=rule.fixedByMonth[String(Number(month.slice(5)))];
  if(id==='pension'&&city.needsHukou&&profile.hukou)result.employer=String(Number(result.employer)+.01);
  return result;
 });
 return {cityId,cityName:city.name,month,custom:false,items,sources:[...new Map(items.flatMap(i=>i.sources).map(s=>[s.url,s])).values()],version:policyVersion};
}
