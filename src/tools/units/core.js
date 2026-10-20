import { math, formatNumber } from '../calculator/core.js';
math.createUnit('cal',{definition:'4.184 J'});
math.createUnit('kcal',{definition:'1000 cal'});
math.createUnit('knot',{definition:'1.852 km/h'});
const mathUnit=id=>({ft2:'ft^2'}[id]||id);
const definitions={
  length:[['m','meter metre 米'],['km','kilometer kilometre 千米 公里'],['cm','centimeter centimetre 厘米'],['mm','millimeter millimetre 毫米'],['um','micrometer 微米'],['nm','nanometer 纳米'],['inch','inch 英寸'],['ft','foot feet 英尺'],['yd','yard 码'],['mile','mile 英里']],
  area:[['m2','square meter 平方米'],['km2','square kilometer 平方千米'],['cm2','square centimeter 平方厘米'],['hectare','hectare 公顷'],['acre','acre 英亩'],['ft2','square foot 平方英尺']],
  volume:[['L','liter litre 升'],['mL','milliliter 毫升'],['m3','cubic meter 立方米'],['cm3','cubic centimeter 立方厘米'],['gallon','US gallon 美制加仑'],['floz','US fluid ounce 美制液盎司']],
  mass:[['kg','kilogram 千克 公斤'],['g','gram 克'],['mg','milligram 毫克'],['tonne','metric ton 吨'],['lb','pound 磅'],['oz','ounce 盎司']],
  temperature:[['degC','Celsius 摄氏度'],['degF','Fahrenheit 华氏度'],['K','Kelvin 开尔文']],
  speed:[['m/s','meter per second 米每秒'],['km/h','kilometer per hour 千米每小时'],['mile/h','mile per hour 英里每小时'],['knot','knot 节']],
  pressure:[['Pa','pascal 帕斯卡'],['kPa','kilopascal 千帕'],['bar','bar 巴'],['atm','atmosphere 标准大气压'],['psi','pound per square inch 磅每平方英寸']],
  energy:[['J','joule 焦耳'],['kJ','kilojoule 千焦'],['cal','calorie 卡路里'],['kcal','kilocalorie 千卡'],['Wh','watt hour 瓦时'],['kWh','kilowatt hour 千瓦时']],
  power:[['W','watt 瓦'],['kW','kilowatt 千瓦'],['MW','megawatt 兆瓦'],['hp','horsepower 马力']],
  angle:[['rad','radian 弧度'],['deg','degree 度'],['grad','gradian 百分度']]
};
export const units=Object.entries(definitions).flatMap(([category,entries])=>entries.map(([id,aliases])=>({id,category,aliases})));
export const categories=Object.keys(definitions);
export function findUnits(query='',category) {const needle=query.trim().toLowerCase();return units.filter(unit=>(!category||unit.category===category)&&`${unit.id} ${unit.aliases}`.toLowerCase().includes(needle));}
const fail=code=>{throw Object.assign(new RangeError(`units.${code}`),{code:`units.${code}`,params:{}});};
export function convertUnits(input,from,targets) {
  if(!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(input).trim())||String(input).length>1000)fail('invalidValue');
  const source=units.find(unit=>unit.id===from);
  if(!source||!Array.isArray(targets)||!targets.length)fail('invalidUnit');
  try {
    const value=math.bignumber(String(input).trim());
    const results=targets.map(id=>{
      const target=units.find(unit=>unit.id===id);if(!target)fail('invalidUnit');if(target.category!==source.category)fail('incompatible');
      const result=formatNumber(math.unit(value,mathUnit(from)).toNumeric(mathUnit(id)));
      return {unit:id,value:result.exact,display:result.display,approximate:result.approximate};
    });
    return {input:String(input),from,results};
  } catch(error) {if(error.code?.startsWith('units.'))throw error;fail('invalidValue');}
}
