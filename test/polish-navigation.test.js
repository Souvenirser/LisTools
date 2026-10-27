import test from 'node:test';
import assert from 'node:assert/strict';
import {searchNavigation} from '../src/tools/shared/navigation.js';
test('common joined tasks lead directly to their existing task or tool without duplicate routes',()=>{
 for(const [query,want]of [['提取邮箱','text.html#extract-email'],['手机号提取','text.html#extract-phone'],['删除重复行','text.html#lines-dedupe'],['PDF提取','pdf.html#extract'],['PDF 提取','pdf.html#extract'],['base64解码','convert.html#base64-decode'],['base64 解码','convert.html#base64-decode'],['extract email','text.html#extract-email'],['remove duplicate lines','text.html#lines-dedupe']]){
  const found=searchNavigation(query);assert.equal(found[0]?.file,want,query);assert.equal(new Set(found.map(item=>item.file)).size,found.length,query);
 }
});
test('exact names outrank generic related tools and old broad conversion searches remain available',()=>{
 assert.equal(searchNavigation('base64')[0].file,'convert.html#base64');assert.equal(searchNavigation('base64url')[0].file,'convert.html#base64url');
 assert.deepEqual(searchNavigation('编码 base64').map(item=>item.file),['convert.html#base64','convert.html#base64url']);
 assert.ok(searchNavigation('decode').some(item=>item.file==='convert.html#jwt'));
 assert.deepEqual(searchNavigation('no such task 987'),[]);
});
