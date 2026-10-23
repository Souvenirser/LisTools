import test from 'node:test';
import assert from 'node:assert/strict';
import {findTools} from '../src/tools/convert/registry.js';
import {findRules} from '../src/tools/regex/rules.js';
import {textKey} from '../src/tools/shared/label-key.js';
test('conversion search accepts localized labels without losing category and original aliases',()=>{
 const t=key=>key===textKey('Colors')?'Farbkonverter':'';
 assert.ok(findTools('Farbkonverter',t).some(tool=>tool.id==='color'));
 assert.ok(findTools('Farbkonverter','number',t).some(tool=>tool.id==='color'));
 assert.equal(findTools('Farbkonverter','format',t).length,0);
 assert.ok(findTools('颜色').some(tool=>tool.id==='color'));
});
test('regex search matches translated names while retaining patterns and English aliases',()=>{
 const original=findRules('email')[0];assert.ok(original);
 const t=key=>key===textKey(original.name[1])?'courriel-local':'';
 assert.ok(findRules('courriel-local',t).some(rule=>rule.id===original.id));
 assert.ok(findRules('邮箱').length);
});
