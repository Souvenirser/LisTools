import { all, create } from 'mathjs';
export const math=create(all,{number:'BigNumber',precision:80,predictable:true});
const functions=new Set(['sqrt','abs','round','floor','ceil','sum','mean','min','max']);
const operators=new Set(['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus']);
const fail=(code,params={})=>{throw Object.assign(new RangeError(`calculator.${code}`),{code:`calculator.${code}`,params});};
export function formatNumber(value) {
  if(!math.isBigNumber(value)||!value.isFinite()||Math.abs(value.e)>10000) fail('nonFinite');
  const exact=value.toString(),display=value.toSignificantDigits(24).toString();
  return {exact,display,approximate:exact!==display};
}
export function calculate(expression) {
  const input=String(expression).trim();
  if(!input||input.length>4000) fail('invalidExpression');
  try {
    const node=math.parse(input);let count=0;
    node.traverse((item,path,parent)=>{
      if(++count>500) fail('tooComplex');
      if(item.isConstantNode){if(typeof item.value==='string'||typeof item.value==='boolean')fail('notAllowed');return;}
      if(item.isParenthesisNode)return;
      if(item.isOperatorNode){if(!operators.has(item.fn))fail('notAllowed');return;}
      if(item.isFunctionNode){if(!item.fn.isSymbolNode||!functions.has(item.fn.name)||item.args.length>100)fail('notAllowed');return;}
      if(item.isSymbolNode&&parent?.isFunctionNode&&path==='fn'&&functions.has(item.name))return;
      fail('notAllowed');
    });
    return {...formatNumber(node.compile().evaluate()),expression:input};
  } catch(error) {if(error.code?.startsWith('calculator.'))throw error;fail('invalidExpression');}
}
export function officeCalculation(mode,first,second) {
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(first)||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(second)) fail('invalidNumber');
  const a=`(${first})`,b=`(${second})`;
  const expressions={growth:`(${b}-${a})/${a}*100`,discount:`${a}*(1-${b}/100)`,share:`${a}/${b}*100`,part:`${a}*${b}/100`,whole:`${a}/${b}*100`};
  if(!expressions[mode])fail('invalidExpression');
  return calculate(expressions[mode]);
}
