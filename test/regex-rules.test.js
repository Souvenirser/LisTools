import test from 'node:test';
import assert from 'node:assert/strict';
import { rules,findRules } from '../src/tools/regex/rules.js';
import {runRegex} from '../src/tools/regex/core.js';

test('all 30 local rules compile and match synthetic positive samples but reject negative samples',async()=> {
  assert.equal(rules.length,30);assert.equal(new Set(rules.map(rule=>rule.id)).size,30);
  for(const rule of rules) {
    for(const text of rule.positive) {
      const result=await runRegex({pattern:rule.pattern,flags:rule.flags,input:text});
      assert.equal(result.status,'ready',`${rule.id}: ${result.message}`);
      assert.ok(result.matches.length>0,`${rule.id}: ${JSON.stringify(text)} must match`);
    }
    for(const text of rule.negative) assert.equal((await runRegex({pattern:rule.pattern,flags:rule.flags,input:text})).matches.length,0,`${rule.id}: ${JSON.stringify(text)} must not match`);
    for(const field of ['name','tags','description','limitation']) assert.ok(rule[field].length===2 && rule[field].every(Boolean),`${rule.id}: bilingual ${field}`);
  }
});
test('rule search covers Chinese, English, tags and descriptions without changing rule data',()=> {
  assert.equal(findRules('邮箱')[0].id,'email');
  assert.ok(findRules('ip').some(rule=>rule.id==='ipv4'));
  assert.ok(findRules('checksum').some(rule=>rule.id==='id-cn'));
  assert.deepEqual(findRules('no-such-pattern-729'),[]);
});
