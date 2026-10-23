import test from 'node:test';
import assert from 'node:assert/strict';
import * as navigation from '../src/tools/shared/navigation.js';

test('MD5 uses a plain checksum name without changing its stable route', () => {
  const md5=navigation.pages.find(page=>page.id==='md5');
  assert.equal(md5.zh,'MD5 校验');
  assert.equal(md5.en,'MD5 checksum');
  assert.equal(md5.file,'convert.html#md5');
  assert.equal(navigation.searchNavigation('MD5 校验')[0].file,'convert.html#md5');
});

test('search directly opens conversion subtools and deduplicates MD5 routes', () => {
  assert.equal(typeof navigation.searchNavigation, 'function');
  assert.equal(navigation.searchNavigation('base64url')[0].file, 'convert.html#base64url');
  assert.equal(navigation.searchNavigation('MD5 摘要').filter(item=>item.file==='convert.html#md5').length, 1);
  assert.ok(navigation.searchNavigation('').length>=44);
  assert.equal(new Set(navigation.searchNavigation('').map(item=>item.file)).size,navigation.searchNavigation('').length);
  assert.deepEqual(navigation.searchNavigation('不存在的工具'), []);
});
test('search combines bilingual category names, aliases and localized labels', () => {
  assert.equal(typeof navigation.searchNavigation, 'function');
  assert.deepEqual(navigation.searchNavigation('编码 base64').map(item=>item.file), ['convert.html#base64','convert.html#base64url']);
  assert.ok(navigation.searchNavigation('decode').some(item=>item.file==='convert.html#jwt'));
  assert.deepEqual(navigation.searchNavigation('crontab').map(item=>item.file), ['cron.html']);
  assert.deepEqual(navigation.searchNavigation('horloge',key=>key==='timestamp.name'?'Horloge':'').map(item=>item.file), ['timestamp.html']);
});
test('conversion groups cover every subtool with stable deep links', () => {
  assert.equal(navigation.conversionGroups?.length, 8);
  const targets=navigation.conversionGroups.flatMap(group=>group.tools.map(item=>item.file));
  assert.equal(targets.length, 37);
  assert.equal(new Set(targets).size, 37);
  assert.ok(targets.includes('convert.html#md5'));
  assert.ok(targets.includes('convert.html#base64'));
});
test('current target distinguishes conversion tools and normalizes fallback hashes', () => {
  assert.equal(typeof navigation.currentTarget, 'function');
  for(const [path,hash,want] of [
    ['/index.html','','index.html'],['/','','index.html'],['/convert.html','','convert.html#base64'],
    ['/convert.html','#md5','convert.html#md5'],['/convert.html','#hex','convert.html#hex'],
    ['/convert.html','#unknown','convert.html#base64'],['/popup.html','',undefined]
  ]) assert.equal(navigation.currentTarget(path,hash),want);
});

test('ordinary task search prefers text tasks and preserves every advanced conversion',()=>{
 assert.deepEqual(navigation.toolGroups.map(group=>group.id),['daily','files','developer','network']);
 assert.equal(navigation.pages.find(page=>page.id==='password').group,'network');
 for(const [query,task]of [['去重','dedupe'],['大小写','case'],['换行','newline']]){
  const matches=navigation.searchNavigation(query);assert.equal(matches[0].file,`text.html#${task}`);
  assert.ok(matches.some(item=>item.file.startsWith('convert.html#')&&item.secondary));
 }
 assert.ok(navigation.searchNavigation('提取 PDF').some(item=>item.file==='pdf.html#extract'));
 assert.equal(navigation.currentTarget('/qr.html','#recognize'),'qr.html#recognize');
 assert.equal(navigation.currentTarget('/qr.html','#unknown'),'qr.html');
});
