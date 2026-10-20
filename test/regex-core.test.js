import test from 'node:test';
import assert from 'node:assert/strict';
import { runRegex, validatePattern, replacementUpperBound } from '../src/tools/regex/core.js';

const run=(pattern,input,flags='g',options={})=>runRegex({pattern,input,flags,...options});
test('global, first-only and sticky matching preserve native JS behavior',async()=> {
  assert.deepEqual((await run('a','ba aa')).matches.map(m=>m.index),[1,3,4]);
  assert.deepEqual((await run('a','ba aa','')).matches.map(m=>m.index),[1]);
  assert.deepEqual((await run('a','aa ba','gy')).matches.map(m=>m.index),[0,1]);
  assert.deepEqual((await run('a','ba','y')).matches,[]);
});
test('zero-length matches advance in Unicode code points for u and code units otherwise',async()=> {
  assert.deepEqual((await run('(?:)','🙂a','gu')).matches.map(m=>m.index),[0,2,3]);
  assert.deepEqual((await run('(?:)','🙂a','g')).matches.map(m=>m.index),[0,1,2,3]);
  assert.equal((await run('$','a\n','gm')).matches.length,2);
});
test('captures distinguish nonparticipation and empty strings, with ranges and line columns',async()=> {
  const result=await run('(?<first>a)?()b','x\r\nb','gd');
  const match=result.matches[0];
  assert.deepEqual([match.index,match.end,match.line,match.column],[3,4,2,1]);
  assert.equal(match.captures[0].value,undefined);
  assert.equal(match.captures[1].value,'');
  assert.deepEqual([match.captures[1].start,match.captures[1].end],[3,3]);
  assert.equal(match.namedGroups.first.value,undefined);
  const json=JSON.parse(await result.jsonBlob.text());
  assert.deepEqual(json.matches[0].captures[0],{number:1,defined:false,value:null});
  assert.equal(json.matches[0].captures[1].defined,true);
});
test('extraction selects the whole match, numbered capture, or named capture',async()=> {
  assert.equal(await (await run('(?<word>\\w+):(\\d+)','a:1 b:2','g',{extractGroup:'2'})).blob.text(),'1\n2');
  assert.equal(await (await run('(?<word>\\w+):(\\d+)','a:1 b:2','g',{extractGroup:'name:word'})).blob.text(),'a\nb');
  assert.equal((await run('(a)','a','g',{extractGroup:'3'})).code,'InvalidGroup');
});
test('replacement supports native tokens literally without evaluating user code',async()=> {
  const pattern='(?<name>a)(b)?'; const input='ab a';
  for(const flags of ['g','']) for(const replacement of ["$$|$&|$1|$2|$<name>|$`|$'",'$12-$99-$0-$<absent>', '${alert(1)}']) {
    const result=await run(pattern,input,flags,{operation:'replace',replacement});
    assert.equal(result.status,'ready',result.message);
    assert.equal(await result.blob.text(),input.replace(new RegExp(pattern,flags),replacement));
  }
  assert.equal(await (await run('a','a','g',{operation:'replace',replacement:'$<name>'})).blob.text(),'$<name>');
});
test('native validation is authoritative and regexpp supplies precise pattern positions',()=> {
  const invalid=validatePattern('a[','g');
  assert.equal(invalid.field,'pattern');assert.equal(invalid.position,2);assert.match(invalid.message,/./);
  assert.equal(validatePattern('a','gg').field,'flags');
  assert.equal(validatePattern('a','uv').field,'flags');
  assert.equal(validatePattern('a','z').field,'flags');
  assert.equal(validatePattern('(?<=a)b','g'),null);
  let hasV=true;try {new RegExp('a','v');}catch {hasV=false;}
  if(hasV)assert.equal(validatePattern('[a&&a]','v'),null);else assert.equal(validatePattern('a','v').field,'flags');
});
test('explicit caps retain 10000 matches and refuse partial replacement',async()=> {
  const result=await run('a','a'.repeat(10001));
  assert.equal(result.matches.length,10000);assert.equal(result.truncated,true);
  assert.equal(result.highlightRanges.length,1000);
  assert.equal((await run('a','a'.repeat(10001),'g',{operation:'replace',replacement:'b'})).code,'MatchLimit');
  assert.equal((await run('x'.repeat(16385),'','g')).code,'PatternLimit');
  assert.equal((await run('a','a','g',{operation:'replace',replacement:'x'.repeat(16385)})).code,'ReplacementLimit');
  assert.equal((await run('a','x'.repeat(10*1024**2+1),'g')).code,'InputLimit');
});
test('conservative replacement bound rejects output expansion before native replace',async()=> {
  assert.equal(replacementUpperBound('x',3,[],0),3);
  const result=await run('a','a'.repeat(10000),'g',{operation:'replace',replacement:"$`$'$`$'"});
  assert.equal(result.code,'OutputLimit');
});
test('full result is preserved in Blob while output preview is capped at 1 MiB',async()=> {
  const result=await run('^','🙂'.repeat(300000),'',{operation:'replace',replacement:'x'});
  assert.equal(result.status,'ready',result.message);assert.equal(result.previewTruncated,true);
  assert.ok(new TextEncoder().encode(result.preview).length<=1024**2);
  assert.equal(await result.blob.text(),'x'+'🙂'.repeat(300000));
});
test('named capture keys such as __proto__ remain data in results and JSON export',async()=> {
  const result=await run('(?<__proto__>a)','a');
  assert.equal(result.matches[0].namedGroups.__proto__.value,'a');
  assert.equal(Object.hasOwn(result.matches[0].namedGroups,'__proto__'),true);
  assert.equal(JSON.parse(await result.jsonBlob.text()).matches[0].namedGroups.__proto__.value,'a');
});
test('replacement estimate also bounds UTF-8 expansion when insertion splits a surrogate pair',()=> {
  const matches=[{value:'',captures:[],namedGroups:{}}];
  assert.ok(replacementUpperBound('x',4,matches)>=7);
});
test('isolated surrogate output fails explicitly before Blob encoding can silently replace it',async()=> {
  for(const options of [
    {pattern:'(?=\\uDE42)',input:'🙂',flags:'g',operation:'replace',replacement:'x'},
    {pattern:'a',input:'a',flags:'g',operation:'replace',replacement:'\ud800'},
    {pattern:'.',input:'🙂',flags:'g'}
  ]) {
    const result=await runRegex(options);
    assert.equal(result.code,'UnicodeOutput');assert.equal(result.blob,undefined);
    assert.match(result.message,/u.*v/);
  }
  assert.equal(await (await run('.', '🙂','gu')).blob.text(),'🙂');
});
test('ignore-case, multiline anchors, dotAll and Unicode-set flags reach the native engine',async()=> {
  assert.equal((await run('a','A','gi')).matches[0].value,'A');
  assert.equal((await run('^a','x\na','gm')).matches[0].index,2);
  assert.equal((await run('a.b','a\nb','gs')).matches[0].value,'a\nb');
  let hasV=true;try {new RegExp('a','v');}catch {hasV=false;}
  if(hasV)assert.deepEqual((await run('[\\p{ASCII}&&\\p{Letter}]','ab12','gv')).matches.map(match=>match.value),['a','b']);
});
