import test from 'node:test';
import assert from 'node:assert/strict';
import {bonusForMonths} from '../src/tools/payroll/tax-input.js';

test('zero bonus months do not require salary and fractional months use exact decimal arithmetic',()=>{
 assert.equal(bonusForMonths('','0'),'0.00');assert.equal(bonusForMonths('20000','1.3'),'26000.00');assert.equal(bonusForMonths('19,999.99','1.3'),'25999.99');assert.equal(bonusForMonths('0.10','1.3'),'0.13');
});
test('invalid or unfinished month counts are rejected, not treated as zero',()=>{
 for(const n of ['','-1','NaN','Infinity','1e2','1.'])assert.throws(()=>bonusForMonths('20000',n),e=>e.field==='tax-bonus-months');
 assert.throws(()=>bonusForMonths('','1.3'),e=>e.field==='tax-salary');
});
