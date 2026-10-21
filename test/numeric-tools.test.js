import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, officeCalculation, math } from '../src/tools/calculator/core.js';
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
  for(const expression of ['x=3','a.b','[1,2]','{a:1}','import("x")','evaluate("2+2")','sin.constructor','sin','1/0','2^1000000']) assert.throws(()=>calculate(expression),error=>error.code.startsWith('calculator.'));
});
test('scientific calculator applies the selected angle unit without changing the shared math functions',()=>{
  for(const [input,angleUnit,want] of [['sin(30)','deg','0.5'],['asin(0.5)','deg','30'],['cos(180)','deg','-1'],['sin(pi/2)','rad','1'],['sin(pi)','rad','0'],['cos(pi/2)','rad','0'],['sin(-180)','deg','0'],['tan(180)','deg','0'],['acos(1)','deg','0'],['atan(1)','deg','45']]) {
    const result=calculate(input,{angleUnit});assert.equal(result.display,want,input);assert.equal(result.context.angleUnit,angleUnit);
  }
  assert.equal(calculate('sin(30)').display,'0.5');
  assert.notEqual(math.sin(math.bignumber(30)).toString(),'0.5');
  assert.notEqual(calculate('sin(1e-20)',{angleUnit:'rad'}).exact,'0');
  assert.ok(Number(calculate('tan(pi/2+1e-25)',{angleUnit:'rad'}).exact)<-1e24);
  assert.throws(()=>calculate('sin(30)',{angleUnit:'invalid'}),{code:'calculator.invalidAngle'});
});
test('scientific functions reject missing or extra arguments instead of ignoring them',()=>{
  for(const input of ['sin(30,60)','sqrt(9,16)','log(8,2,3)','factorial(5,2)','combinations(5,2,1)','ln()','nthRoot(8,3,2)'])assert.throws(()=>calculate(input),{code:'calculator.invalidExpression'},input);
});
test('quadrant reduction preserves representable values immediately beside a pole',()=>{
  assert.notEqual(calculate('cos(90+1e-78)').exact,'0');
  assert.ok(Number(calculate('tan(90+1e-78)').exact)<-1e79);
  assert.ok(Number(calculate('tan(90-1e-78)').exact)>1e79);
  assert.equal(calculate('tan(90-1e-40)').display,'5.72957795130823208767982e+41');
  assert.equal(calculate('tan(90-1e-44)').display,'5.72957795130823208767982e+45');
  assert.ok(Number(calculate('tan(-90+1e-78)').exact)<-1e79);
  assert.ok(Number(calculate('tan(-90-1e-78)').exact)>1e79);
  assert.notEqual(calculate('cos(-90-1e-78)').exact,'0');
  for(const input of ['tan(7*pi/2)','tan(-7*pi/2)'])assert.throws(()=>calculate(input,{angleUnit:'rad'}),{code:'calculator.tanUndefined'});
  assert.equal(calculate('cos(7*pi/2)',{angleUnit:'rad'}).exact,'0');
  assert.notEqual(calculate('cos(7*pi/2+1e-70)',{angleUnit:'rad'}).exact,'0');
});
test('scientific calculator supports real logarithms roots constants and integer combinatorics',()=>{
  for(const [input,want] of [['log10(100)','2'],['ln(e)','1'],['log(8,2)','3'],['exp(0)','1'],['nthRoot(-8,3)','-2'],['cbrt(-8)','-2'],['square(3)+cube(2)','17'],['5!','120'],['factorial(0)','1'],['combinations(5,2)','10'],['permutations(5,2)','20'],['combinations(5,0)','1']]) assert.equal(calculate(input).display,want,input);
  assert.equal(calculate('pi').approximate,true);
});
test('scientific calculator explains invalid domains and tangent poles',()=>{
  for(const input of ['tan(90)','tan(270)','tan(-90)'])assert.throws(()=>calculate(input),{code:'calculator.tanUndefined'});
  for(const input of ['tan(pi/2)','tan(3*pi/2)','tan(-pi/2)'])assert.throws(()=>calculate(input,{angleUnit:'rad'}),{code:'calculator.tanUndefined'});
  for(const input of ['sqrt(-1)','asin(2)','acos(-2)','nthRoot(16,0)','(-8)^(1/3)'])assert.throws(()=>calculate(input),{code:'calculator.domainError'});
  for(const input of ['ln(0)','log10(-1)','log(8,1)','log(8,-2)'])assert.throws(()=>calculate(input),{code:'calculator.logDomain'});
  for(const input of ['(-1)!','1.5!'])assert.throws(()=>calculate(input),{code:'calculator.factorialDomain'});
  for(const input of ['combinations(5,6)','permutations(-1,0)','combinations(5,1.5)'])assert.throws(()=>calculate(input),{code:'calculator.combinatoricsDomain'});
});
test('calculator retains full precision for Ans and fixes rounding boundaries',()=>{
  const result=calculate('Ans*10',{angleUnit:'rad',ans:'0.3'});assert.equal(result.exact,'3');assert.deepEqual(result.context,{angleUnit:'rad',ans:'0.3'});
  assert.throws(()=>calculate('Ans+1'),{code:'calculator.noPreviousAnswer'});
  assert.throws(()=>calculate('Ans+1',{ans:'1+1'}),{code:'calculator.invalidNumber'});
  for(const [input,want] of [['floor(0.9999999999999)','0'],['ceil(1.0000000000001)','2'],['round(0.4999999999999)','0'],['round(-1.5)','-2'],['floor(1.234,2)','1.23'],['ceil(1.234,2)','1.24']])assert.equal(calculate(input).exact,want,input);
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
