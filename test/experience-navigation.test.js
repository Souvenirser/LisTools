import test from 'node:test';import assert from 'node:assert/strict';
import {searchNavigation,currentTarget} from '../src/tools/shared/navigation.js';
test('specific action searches expose distinct preset routes while broad searches retain the original tools',()=>{
 for(const [query,want]of [['手机号提取','text.html#extract-phone'],['extract email','text.html#extract-email'],['提取链接','text.html#extract-url'],['删除空行','text.html#lines-remove-empty'],['逐行去空白','text.html#lines-trim'],['排序','text.html#lines-sort'],['转大写','text.html#case-upper'],['base64 decode','convert.html#base64-decode']])assert.equal(searchNavigation(query)[0]?.file,want,query);
 assert.equal(searchNavigation('base64')[0].file,'convert.html#base64');
 assert.equal(currentTarget('/text.html','#extract-phone'),'text.html#extract');assert.equal(currentTarget('/convert.html','#base64-decode'),'convert.html#base64');assert.equal(currentTarget('/text.html','#extract-arbitrary'),'text.html');
});
