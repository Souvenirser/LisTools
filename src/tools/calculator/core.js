import { all, create } from 'mathjs';
export const math=create(all,{number:'BigNumber',precision:80,predictable:true,relTol:1e-75,absTol:1e-78});
const functions=new Set(['sqrt','abs','round','floor','ceil','sum','mean','min','max','sin','cos','tan','asin','acos','atan','log','log10','ln','exp','square','cube','nthRoot','cbrt','factorial','combinations','permutations']);
const angles=new Set(['sin','cos','tan','asin','acos','atan']);
const arities={log:[1,2],nthRoot:[1,2],combinations:[2,2],permutations:[2,2],round:[1,2],floor:[1,2],ceil:[1,2],sum:[1,100],mean:[1,100],min:[1,100],max:[1,100]};
const operators=new Set(['add','subtract','multiply','divide','pow','unaryMinus','unaryPlus','factorial']);
const fail=(code,params={})=>{throw Object.assign(new RangeError(`calculator.${code}`),{code:`calculator.${code}`,params});};
export function formatNumber(value) {
  if(!math.isBigNumber(value)||!value.isFinite()||Math.abs(value.e)>10000) fail('nonFinite');
  const exact=value.toString(),display=value.toSignificantDigits(24).toString();
  return {exact,display,approximate:exact!==display};
}
// Keep explicit rational multiples of pi exact without treating numeric near-poles as quadrants.
function piMultiple(node) {
  if(node.isParenthesisNode)return piMultiple(node.content);
  if(node.isSymbolNode&&node.name==='pi')return {degree:1,value:math.fraction(1)};
  if(node.isConstantNode&&math.isBigNumber(node.value)&&Math.abs(node.value.e)<=10000)return {degree:0,value:math.fraction(node.value.toFixed())};
  if(!node.isOperatorNode||!['add','subtract','multiply','divide','unaryMinus','unaryPlus'].includes(node.fn))return;
  const a=piMultiple(node.args[0]);if(!a)return;
  if(node.fn==='unaryMinus')return {...a,value:a.value.neg()};
  if(node.fn==='unaryPlus')return a;
  const b=piMultiple(node.args[1]);if(!b)return;
  if(node.fn==='multiply')return {degree:a.degree+b.degree,value:a.value.mul(b.value)};
  if(node.fn==='divide')return b.value.n===0n?undefined:{degree:a.degree-b.degree,value:a.value.div(b.value)};
  if(a.degree===b.degree)return {degree:a.degree,value:node.fn==='add'?a.value.add(b.value):a.value.sub(b.value)};
}
function scopeFor(angleUnit,ans) {
  const real=value=>{if(!math.isBigNumber(value)||!value.isFinite())fail('domainError');return value;};
  const scope=new Map([['pi',math.pi],['e',math.e]]);
  if(ans!==undefined)scope.set('Ans',ans);
  for(const name of ['sin','cos','tan'])scope.set(name,value=>{
    const x=real(value),quarter=angleUnit==='deg'?math.bignumber(90):math.divide(math.pi,math.bignumber(2));
    // Reduce before division/conversion so representable offsets beside a pole survive rounding.
    const reduced=x.abs().mod(quarter.times(4));let offset=reduced.mod(quarter),quadrant=reduced.minus(offset).div(quarter).toNumber();
    if(offset.gt(quarter.div(2))){offset=offset.minus(quarter);quadrant++;}
    else if(offset.lt(quarter.div(-2))){offset=offset.plus(quarter);quadrant--;}
    quadrant=(quadrant%4+4)%4;
    if(name==='tan'&&quadrant%2&&offset.isZero())fail('tanUndefined');
    const radians=angleUnit==='deg'?offset.times(math.pi).div(180):offset;
    const sine=math.sin(radians),cosine=math.cos(radians);
    const trigResult=name==='tan'?(quadrant%2?cosine.neg().div(sine):sine.div(cosine)):name==='sin'?[sine,cosine,sine.neg(),cosine.neg()][quadrant]:[cosine,sine.neg(),cosine.neg(),sine][quadrant];
    return x.isNegative()&&name!=='cos'?trigResult.neg():trigResult;
  });
  for(const name of ['asin','acos','atan'])scope.set(name,value=>{
    const x=real(value);if(name!=='atan'&&x.abs().gt(1))fail('domainError');
    const radians=math[name](x);return angleUnit==='deg'?radians.times(180).div(math.pi):radians;
  });
  const logarithm=(value,base)=>{
    if(real(value).lte(0)||(base!==undefined&&(real(base).lte(0)||base.eq(1))))fail('logDomain');
    return base===undefined?math.log(value):math.log(value,base);
  };
  scope.set('log',logarithm);scope.set('ln',value=>logarithm(value));scope.set('log10',value=>logarithm(value,math.bignumber(10)));
  scope.set('sqrt',value=>{if(real(value).lt(0))fail('domainError');return math.sqrt(value);});
  scope.set('nthRoot',(value,root=math.bignumber(2))=>{
    real(value);real(root);if(root.isZero()||(value.lt(0)&&(!root.isInteger()||root.mod(2).isZero())))fail('domainError');
    return math.nthRoot(value,root);
  });
  scope.set('cbrt',value=>math.nthRoot(real(value),math.bignumber(3)));
  scope.set('factorial',value=>{
    if(real(value).lt(0)||!value.isInteger())fail('factorialDomain');return math.factorial(value);
  });
  for(const name of ['combinations','permutations'])scope.set(name,(n,r)=>{
    real(n);real(r);if(!n.isInteger()||!r.isInteger()||n.lt(0)||r.lt(0)||r.gt(n))fail('combinatoricsDomain');
    return math[name](n,r);
  });
  return scope;
}
export function calculate(expression,{angleUnit='deg',ans}={}) {
  const input=String(expression).trim();
  if(!input||input.length>4000) fail('invalidExpression');
  if(!['deg','rad'].includes(angleUnit))fail('invalidAngle');
  try {
    let answer;
    if(ans!==undefined){
      if(typeof ans!=='string'||ans.length>4000||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(ans))fail('invalidNumber');
      answer=math.bignumber(ans);if(!answer.isFinite()||Math.abs(answer.e)>10000)fail('invalidNumber');
    }
    const node=math.parse(input);let count=0,usesAns=false,usesAngle=false;
    node.traverse((item,path,parent)=>{
      if(++count>500) fail('tooComplex');
      if(item.isConstantNode){if(typeof item.value==='string'||typeof item.value==='boolean')fail('notAllowed');return;}
      if(item.isParenthesisNode)return;
      if(item.isOperatorNode){if(!operators.has(item.fn))fail('notAllowed');return;}
      if(item.isFunctionNode){
        if(!item.fn.isSymbolNode||!functions.has(item.fn.name)||item.args.length>100)fail('notAllowed');
        const [min,max]=arities[item.fn.name]||[1,1];if(item.args.length<min||item.args.length>max)fail('invalidExpression');
        if(angles.has(item.fn.name))usesAngle=true;return;
      }
      if(item.isSymbolNode&&parent?.isFunctionNode&&path==='fn'&&functions.has(item.name))return;
      if(item.isSymbolNode&&['pi','e','Ans'].includes(item.name)){if(item.name==='Ans')usesAns=true;return;}
      fail('notAllowed');
    });
    if(usesAns&&answer===undefined)fail('noPreviousAnswer');
    // Operator nodes bypass scope lookup; route postfix factorials through the same domain check.
    const executable=node.transform(function scopedNode(item){
      if(item.isOperatorNode&&item.fn==='factorial')return new math.FunctionNode('factorial',item.args.map(arg=>arg.transform(scopedNode)));
      if(angleUnit==='rad'&&item.isFunctionNode&&['sin','cos','tan'].includes(item.fn.name)){
        const multiple=piMultiple(item.args[0]);
        if(multiple?.degree===1){
          const turns=multiple.value.mul(2);
          if(turns.d===1n){
            const quadrant=Number((turns.s*turns.n%4n+4n)%4n),name=item.fn.name;
            if(name==='tan'&&quadrant%2)fail('tanUndefined');
            return new math.ConstantNode(math.bignumber(name==='sin'?[0,1,0,-1][quadrant]:name==='cos'?[1,0,-1,0][quadrant]:0));
          }
        }
      }
      return item;
    });
    const value=executable.compile().evaluate(scopeFor(angleUnit,answer));
    if(math.isBigNumber(value)&&value.isNaN())fail('domainError');
    return {...formatNumber(value),expression:input,context:{angleUnit,...(usesAns?{ans:answer.toString()}:{})},usesAngle};
  } catch(error) {if(error.code?.startsWith('calculator.'))throw error;fail('invalidExpression');}
}
export function officeCalculation(mode,first,second) {
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(first)||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(second)) fail('invalidNumber');
  const a=`(${first})`,b=`(${second})`;
  const expressions={growth:`(${b}-${a})/${a}*100`,discount:`${a}*(1-${b}/100)`,share:`${a}/${b}*100`,part:`${a}*${b}/100`,whole:`${a}/${b}*100`};
  if(!expressions[mode])fail('invalidExpression');
  return calculate(expressions[mode]);
}
