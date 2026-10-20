import { RegExpParser } from '@eslint-community/regexpp';
import {validText} from '../convert/bytes.js';

export const limits={input:10*1024**2,pattern:16*1024,replacement:16*1024,output:100*1024**2,preview:1024**2,matches:10000,highlights:1000};
const encoder=new TextEncoder();
const bytes=text=>encoder.encode(text).length;
const fail=(code,message,details={})=>({status:'error',code,message,...details});
const parser=new RegExpParser({ecmaVersion:2025});
const supportsIndices=(()=>{try {new RegExp('','d');return true;}catch {return false;}})();

export function validatePattern(pattern,flags) {
  const seen=new Set();
  for(let index=0;index<flags.length;index++) {
    const flag=flags[index];
    if(!'dgimsuvy'.includes(flag) || seen.has(flag)) return fail('InvalidFlags',`无效或重复标志 / Invalid or duplicate flag: ${flag}`,{field:'flags',position:index});
    seen.add(flag);
  }
  if(seen.has('u') && seen.has('v')) return fail('InvalidFlags','u 与 v 不能同时使用 / Flags u and v are mutually exclusive',{field:'flags',position:flags.indexOf('v')});
  try {new RegExp('',flags);}catch(error) {return fail('UnsupportedFlag',error.message,{field:'flags'});}
  try {new RegExp(pattern,flags);return null;}catch(error) {
    let position;
    try {parser.parsePattern(pattern,0,pattern.length,{unicode:seen.has('u'),unicodeSets:seen.has('v')});}
    catch(diagnostic) {if(Number.isInteger(diagnostic.index)) position=Math.min(pattern.length,Math.max(0,diagnostic.index));}
    return fail('InvalidPattern',error.message,{field:'pattern',...(position===undefined?{}:{position})});
  }
}
function advance(text,index,unicode) {
  if(unicode && index+1<text.length) {
    const first=text.charCodeAt(index), second=text.charCodeAt(index+1);
    if(first>=0xd800 && first<=0xdbff && second>=0xdc00 && second<=0xdfff) return index+2;
  }
  return index+1;
}
function lineStarts(input) {
  const starts=[0];
  for(let i=0;i<input.length;i++) {
    if(input[i]==='\r') {if(input[i+1]==='\n') i++;starts.push(i+1);}
    else if(input[i]==='\n' || input[i]==='\u2028' || input[i]==='\u2029') starts.push(i+1);
  }
  return starts;
}
function location(starts,index) {
  let low=0,high=starts.length;
  while(low+1<high) {const mid=(low+high)>>1;if(starts[mid]<=index) low=mid;else high=mid;}
  return {line:low+1,column:index-starts[low]+1};
}
function capture(value,range,number) {
  return {...(number===undefined?{}:{number}),value,...(range?{start:range[0],end:range[1]}:{})};
}
const jsonCapture=group=>({...group,defined:group.value!==undefined,value:group.value??null});
function jsonMatch(match) {
  return {...match,captures:match.captures.map(jsonCapture),namedGroups:Object.fromEntries(Object.entries(match.namedGroups).map(([name,group])=>[name,jsonCapture(group)]))};
}
export function replacementUpperBound(replacement,inputBytes,matches) {
  // Count the literal template as well as possible substitutions. This deliberately
  // overestimates output, so the native replace is never called above the budget.
  const tokens=[...replacement.matchAll(/\$(\$|&|`|'|[0-9]{1,2}|<[^>]*>)/g)].map(match=>match[1]);
  let total=inputBytes;
  const templateBytes=bytes(replacement);
  for(const match of matches) {
    // A match may split a surrogate pair at either boundary. UTF-8 then
    // encodes the remaining unpaired units as replacement characters.
    total+=templateBytes+4;
    for(const token of tokens) {
      if(token==='`' || token==="'") total+=inputBytes;
      else if(token==='&') total+=bytes(match.value);
      else if(token.startsWith('<')) total+=bytes(match.namedGroups[token.slice(1,-1)]?.value || '');
      else if(token!=='$') {
        const number=Number(token);
        // $12 may resolve as $1 followed by 2 when capture 12 does not exist.
        total+=bytes((match.captures[number-1] || match.captures[Number(token[0])-1])?.value || '');
      }
      if(total>limits.output) return total;
    }
    if(total>limits.output) return total;
  }
  return total;
}
export async function runRegex({pattern='',flags='g',input='',replacement='',operation='match',extractGroup='0'}={}) {
  const started=performance.now();
  if(typeof input!=='string' || typeof pattern!=='string' || typeof flags!=='string' || typeof replacement!=='string') return fail('InvalidInput','请输入文本 / Text input is required');
  if(bytes(pattern)>limits.pattern) return fail('PatternLimit','模式超过 16 KiB / Pattern exceeds 16 KiB',{field:'pattern'});
  if(bytes(replacement)>limits.replacement) return fail('ReplacementLimit','替换文本超过 16 KiB / Replacement exceeds 16 KiB',{field:'replacement'});
  const inputBytes=bytes(input);
  if(inputBytes>limits.input) return fail('InputLimit','输入超过 10 MiB / Input exceeds 10 MiB');
  const invalid=validatePattern(pattern,flags);if(invalid) return invalid;
  try {
    const effectiveFlags=flags+(flags.includes('g')?'':'g')+(supportsIndices && !flags.includes('d')?'d':'');
    const regexp=new RegExp(pattern,effectiveFlags), matches=[],starts=lineStarts(input);
    let truncated=false, resultBudget=0;
    while(true) {
      const native=regexp.exec(input);if(!native) break;
      if(matches.length===limits.matches) {truncated=true;break;}
      const match={index:native.index,end:native.index+native[0].length,value:native[0],...location(starts,native.index),captures:[],namedGroups:Object.create(null)};
      resultBudget+=native[0].length*6+256;
      for(let number=1;number<native.length;number++) {
        resultBudget+=(native[number]?.length || 0)*6+128;
        if(resultBudget>limits.output) return fail('OutputLimit','匹配与分组结果可能超过 100 MiB / Match and capture results may exceed 100 MiB');
        match.captures.push(capture(native[number],native.indices?.[number],number));
      }
      for(const [name,value] of Object.entries(native.groups || {})) {
        resultBudget+=(value?.length || 0)*6+name.length*6+128;
        if(resultBudget>limits.output) return fail('OutputLimit','匹配与分组结果可能超过 100 MiB / Match and capture results may exceed 100 MiB');
        match.namedGroups[name]=capture(value,native.indices?.groups?.[name]);
      }
      if(resultBudget>limits.output) return fail('OutputLimit','匹配结果可能超过 100 MiB / Match results may exceed 100 MiB');
      matches.push(match);
      if(!flags.includes('g')) break;
      if(native[0]==='') regexp.lastIndex=advance(input,regexp.lastIndex,flags.includes('u') || flags.includes('v'));
    }
    let selected;
    if(extractGroup!=='0') {
      if(extractGroup.startsWith('name:')) {
        const name=extractGroup.slice(5);
        if(matches.length && !Object.hasOwn(matches[0].namedGroups,name)) return fail('InvalidGroup','该命名分组不存在 / Named capture does not exist');
        selected=match=>match.namedGroups[name]?.value;
      } else {
        const number=Number(extractGroup);
        if(!Number.isInteger(number) || number<1 || (matches.length && number>matches[0].captures.length)) return fail('InvalidGroup','该编号分组不存在 / Capture number does not exist');
        selected=match=>match.captures[number-1]?.value;
      }
    } else selected=match=>match.value;
    let output;
    if(operation==='replace') {
      if(truncated) return fail('MatchLimit','匹配超过 10000 条，未执行替换；请缩小输入 / Over 10000 matches; replacement was not run. Reduce the input.');
      if(replacementUpperBound(replacement,inputBytes,matches)>limits.output) return fail('OutputLimit','保守估算替换结果可能超过 100 MiB，未执行替换 / Conservative output estimate exceeds 100 MiB; replacement was not run');
      output=input.replace(new RegExp(pattern,flags),replacement);
    } else output=matches.map(match=>selected(match)??'').join('\n');
    try {validText(output);}catch {return fail('UnicodeOutput','结果包含孤立 Unicode 代理项，无法无损编码；请使用 u / v 或调整模式、替换文本 / Output contains isolated Unicode surrogates and cannot be encoded losslessly. Use u / v or adjust the pattern/replacement.');}
    const blob=new Blob([output],{type:'text/plain;charset=utf-8'});
    if(blob.size>limits.output) return fail('OutputLimit','输出超过 100 MiB / Output exceeds 100 MiB');
    const previewTruncated=blob.size>limits.preview;
    const preview=previewTruncated?new TextDecoder().decode(await blob.slice(0,limits.preview).arrayBuffer(),{stream:true}):output;
    const jsonBlob=new Blob([JSON.stringify({pattern,flags,operation,extractGroup,truncated,matches:matches.map(jsonMatch),extracted:matches.map(match=>({defined:selected(match)!==undefined,value:selected(match)??null}))},null,2)],{type:'application/json;charset=utf-8'});
    if(jsonBlob.size>limits.output) return fail('OutputLimit','JSON 分组结果超过 100 MiB / JSON capture output exceeds 100 MiB');
    return {status:'ready',matches,truncated,highlightRanges:matches.slice(0,limits.highlights).map(({index,end})=>({from:index,to:end})),blob,jsonBlob,preview,previewTruncated,outputBytes:blob.size,inputBytes,durationMs:Math.round(performance.now()-started),operation,extractGroup,indicesAvailable:supportsIndices};
  } catch(error) {return fail('RegexError',error.message);}
}
