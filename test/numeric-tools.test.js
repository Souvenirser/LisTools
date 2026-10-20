import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, officeCalculation } from '../src/tools/calculator/core.js';
import { difference, shiftDate, businessDays, dateMilestone } from '../src/tools/dates/core.js';
import { convertUnits, findUnits } from '../src/tools/units/core.js';
import { formatMoney } from '../src/tools/money/core.js';

test('calculator preserves decimals and percentage growth semantics',()=>{
  assert.equal(calculate('0.1 + 0.2').exact,'0.3');
  assert.equal(calculate('200 + 10%').exact,'220');
  assert.equal(calculate('sqrt(81) + abs(-2) + round(1.6) + floor(1.9) + ceil(1.1)').exact,'16');
  assert.equal(calculate('sum(1,2,3) + mean(2,4) + min(4,5) + max(1,2)').exact,'15');
  assert.equal(calculate('2^10').exact,'1024');
  assert.equal(calculate('1/3').approximate,true);
});
test('calculator denies arbitrary syntax and non-finite results',()=>{
  for(const expression of ['x=3','a.b','[1,2]','{a:1}','import("x")','sin(2)','1/0','2^1000000']) assert.throws(()=>calculate(expression),error=>error.code.startsWith('calculator.'));
});
test('office formulas handle growth discount and proportions',()=>{
  assert.equal(officeCalculation('growth','100','120').exact,'20');
  assert.equal(officeCalculation('discount','200','15').exact,'170');
  assert.equal(officeCalculation('share','20','80').exact,'25');
  assert.equal(officeCalculation('part','200','25').exact,'50');
  assert.equal(officeCalculation('whole','50','25').exact,'200');
});
test('dates compare pure dates, include end explicitly, and constrain leap/month ends',()=>{
  assert.equal(difference('2024-02-28','2024-03-01').days,2);
  assert.equal(difference('2024-02-28','2024-03-01',true).days,3);
  assert.equal(difference('2024-03-01','2024-02-28',true).days,-3);
  assert.equal(shiftDate('2024-01-31',1,'months'),'2024-02-29');
  assert.equal(shiftDate('2024-02-29',1,'years'),'2025-02-28');
  assert.throws(()=>difference('2024-02-30','2024-03-01'),{code:'dates.invalidDate'});
});
test('business dates count weekdays with explicit work dates overriding holidays',()=>{
  assert.equal(businessDays('2026-10-12','2026-10-18',{off:['2026-10-12','2026-10-17'],work:['2026-10-17']}),5);
  assert.equal(businessDays('2026-10-12','2026-10-12'),0);
  assert.equal(businessDays('2026-10-12','2026-10-12',{inclusive:true}),1);
});
test('anniversary constrains February 29 and advances past this year',()=>{
  assert.deepEqual(dateMilestone('2000-02-29','2025-03-01'),{years:25,next:'2026-02-28',days:364});
});
test('units convert exact scales, affine temperatures and aliases',()=>{
  assert.equal(convertUnits('1','km',['m','cm']).results[0].value,'1000');
  assert.equal(convertUnits('32','degF',['degC']).results[0].value,'0');
  assert.equal(convertUnits('1','m2',['cm2']).results[0].value,'10000');
  assert.equal(findUnits('千米').some(unit=>unit.id==='km'),true);
  assert.equal(findUnits('kilomet').some(unit=>unit.id==='km'),true);
  assert.throws(()=>convertUnits('1','m',['kg']),{code:'units.incompatible'});
});
test('money rounds half up and preserves large string amounts in every output',()=>{
  const result=formatMoney('-123456789012345.125');
  assert.equal(result.rounded,'-123456789012345.13');
  assert.equal(result.grouped,'-123,456,789,012,345.13');
  assert.equal(result.didRound,true);
  assert.match(result.simplified,/负/);
  assert.match(result.traditional,/負/);
  assert.equal(formatMoney('1,234.00').rounded,'1234.00');
  assert.equal(formatMoney('-0.001').rounded,'0.00');
  assert.match(formatMoney('0').simplified,/零/);
  for(const input of ['1,23','Infinity','1e3','', '12.3.4']) assert.throws(()=>formatMoney(input),{code:'money.invalidAmount'});
});
test('offered customary units have executable definitions',()=>{
  assert.equal(convertUnits('1','ft2',['m2']).results[0].value,'0.09290304');
  assert.equal(convertUnits('1','knot',['km/h']).results[0].value,'1.852');
  assert.equal(convertUnits('1','cal',['J']).results[0].value,'4.184');
  assert.equal(convertUnits('1','kcal',['J']).results[0].value,'4184');
});
test('money financial outputs include integer suffix and independent scripts',()=>{
  assert.equal(formatMoney('0').simplified,'零元整');
  assert.equal(formatMoney('10').simplified,'壹拾元整');
  assert.equal(formatMoney('10').traditional,'壹拾圓整');
  assert.equal(formatMoney('1.01').simplified,'壹元零壹分');
});
test('date anniversaries use constrained month ends consistently for completed years',()=>{
  assert.equal(dateMilestone('2000-02-29','2025-02-28').years,25);
  assert.equal(dateMilestone('2000-02-29','2025-02-27').years,24);
  assert.equal(difference('2024-02-28','2024-03-01',true).calendarDays,3);
  assert.throws(()=>shiftDate('2024-01-01','','days'),{code:'dates.invalidAmount'});
});
