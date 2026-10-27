import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney} from '../src/tools/money/core.js';
for(const [input,rounded]of [['.5','0.50'],['+.5','0.50'],['-.5','-0.50']])test(`money accepts leading-decimal ${input} without changing rounding`,()=>{const result=formatMoney(input);assert.equal(result.original,input);assert.equal(result.rounded,rounded);assert.equal(result.didRound,false);});
test('money keeps strict grouping and half-up rules',()=>{for(const input of ['1,23','.','+.','-.','1,234.5.6'])assert.throws(()=>formatMoney(input),{code:'money.invalidAmount'});assert.equal(formatMoney('1,234.565').rounded,'1234.57');assert.equal(formatMoney('-.005').rounded,'-0.01');});
