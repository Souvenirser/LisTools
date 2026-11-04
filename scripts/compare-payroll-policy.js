// Report a locally supplied candidate snapshot. Never overwrite verified rules.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function comparePolicies(current,candidate){
 if(!Array.isArray(candidate?.cities))throw new TypeError('Expected a local payroll policy catalog with cities[]');
 const flatten=catalog=>new Map(catalog.cities.flatMap(city=>city.periods.flatMap(period=>period.items.map(item=>[`${city.id}/${item.id}/${item.from}/${item.to}`,item]))));
 const before=flatten(current),after=flatten(candidate),changes=[];
 for(const key of new Set([...before.keys(),...after.keys()])){
  const a=before.get(key),b=after.get(key);
  if(JSON.stringify(a)!==JSON.stringify(b))changes.push({key,status:!a?'added':!b?'removed':'changed',before:a,after:b});
 }
 return changes;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw new TypeError('Usage: node scripts/compare-payroll-policy.js <candidate.json>');
 const current=JSON.parse(await readFile(new URL('../src/tools/payroll/cities.json',import.meta.url),'utf8')),candidate=JSON.parse(await readFile(process.argv[2],'utf8'));
 console.log(JSON.stringify({current:current.version,candidate:candidate.version,changes:comparePolicies(current,candidate)},null,2));
}
