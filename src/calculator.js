import { initTool, $, clearStatus, taskRunner } from './tools/shared/office.js';
import { copyText } from './tools/shared/page.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import './tools/calculator/style.css';

initTool('calculator',`
<div class="calculator-layout">
<section class="tool-card calculator-workbench">
  <div class="calculator-controls">
    <div class="calculator-modes" role="group" data-i18n-aria-label="calculator.mode">
      <button id="calc-mode-standard" aria-pressed="true" data-i18n="calculator.standard"></button>
      <button id="calc-mode-scientific" aria-pressed="false" data-i18n="calculator.scientific"></button>
    </div>
    <label class="calculator-angle" for="angle-unit"><span data-i18n="calculator.angleUnit"></span>
      <select id="angle-unit"><option value="deg" data-i18n="calculator.degrees"></option><option value="rad" data-i18n="calculator.radians"></option></select>
    </label>
  </div>
  <div class="field"><label for="expression" data-i18n="calculator.expression"></label><input id="expression" dir="ltr" autocomplete="off" spellcheck="false" value="200 + 10%" aria-describedby="expression-hint argument-hint"></div>
  <p id="expression-hint" class="tool-note" data-i18n="calculator.expressionHint"></p>
  <p id="argument-hint" class="tool-note" hidden></p>
  <div class="calculator-display"><label for="result" data-i18n="calculator.result"></label><output id="result" class="numeric-result" dir="ltr" aria-live="polite"></output><span id="result-context" class="tool-note" hidden></span></div>
  <p id="approximate" class="tool-note" data-i18n="calculator.approximate" hidden></p>
  <div id="calculator-keyboards" class="calculator-keyboards" dir="ltr"><div id="scientific-keypad" class="calculator-keypad" hidden></div><div id="keypad" class="calculator-keypad"></div></div>
  <div class="tool-actions"><button id="copy" data-i18n="calculator.copy" disabled></button><button id="cancel" data-i18n="calculator.cancel" disabled></button></div>
  <p class="tool-note" data-i18n="calculator.keyboardHint"></p><p class="tool-note" data-i18n="calculator.precision"></p>
  <details><summary data-i18n="calculator.functions"></summary><p class="tool-note" data-i18n="calculator.functionHelp"></p></details>
</section>
<aside class="calculator-sidebar">
  <section class="tool-card"><h2 data-i18n="calculator.history"></h2><p id="history-empty" class="tool-note" data-i18n="calculator.historyEmpty"></p><ul id="history" class="numeric-history"></ul></section>
  <section class="tool-card"><details id="business-details"><summary data-i18n="calculator.business"></summary><div class="field"><label for="mode" data-i18n="calculator.mode"></label><select id="mode">${['growth','discount','share','part','whole'].map(mode=>`<option value="${mode}" data-i18n="calculator.${mode}"></option>`).join('')}</select></div><div class="tool-fields"><div class="field"><label for="first" data-i18n="calculator.first"></label><input id="first" dir="ltr" inputmode="decimal" value="100"></div><div class="field"><label for="second" data-i18n="calculator.second"></label><input id="second" dir="ltr" inputmode="decimal" value="120"></div></div><p class="tool-note" data-i18n="calculator.businessHint"></p><button id="business-run" data-i18n="calculator.calculate"></button></details></section>
</aside>
</div>`);

let result,ans,argumentHint,history=[];
const runner=taskRunner(()=>new Worker(new URL('./tools/calculator/worker.js',import.meta.url),{type:'module'}),{
  timeoutMs:2500,
  onResult(state){
    result=state.result;ans=result.exact;
    $('result').textContent=(result.approximate?'≈ ':'')+result.display;
    $('approximate').hidden=!result.approximate;$('copy').disabled=false;
    history.unshift(result);history=history.slice(0,30);renderHistory();renderContext();
  },
  onState(state){$('cancel').disabled=state.status!=='pending';}
});
function renderContext(){
  $('result-context').hidden=!result?.usesAngle;
  $('result-context').textContent=result?.usesAngle?t(`calculator.${result.context.angleUnit==='deg'?'degrees':'radians'}`):'';
}
function renderHistory(){
  $('history-empty').hidden=history.length>0;
  $('history').replaceChildren(...history.map(item=>{
    const li=document.createElement('li'),button=document.createElement('button');
    const context=item.usesAngle?` · ${item.context.angleUnit.toUpperCase()}`:'';
    button.textContent=`${item.expression} = ${item.approximate?'≈ ':''}${item.display}${context}`;
    button.title=t('calculator.reuse');button.dir='ltr';
    button.addEventListener('click',()=>{
      // Successful expressions only contain whitelisted names; also freeze implicit products such as 2Ans.
      $('expression').value=item.context.ans===undefined?item.expression:item.expression.replaceAll('Ans',`(${item.context.ans})`);
      $('angle-unit').value=item.context.angleUnit;invalidate();$('expression').focus();
    });
    li.append(button);return li;
  }));
}
function invalidate(){
  runner.invalidate();clearStatus();result=undefined;$('result').textContent='';$('copy').disabled=true;$('approximate').hidden=true;renderContext();
}
function run(business=false){
  clearStatus();result=undefined;$('copy').disabled=true;$('result').textContent='';$('approximate').hidden=true;renderContext();
  runner.process(business?{mode:$('mode').value,first:$('first').value,second:$('second').value}:{input:$('expression').value,angleUnit:$('angle-unit').value,ans});
}
function clear(){ $('expression').value='';argumentHint=undefined;renderArgumentHint();invalidate();$('expression').focus(); }
function renderArgumentHint(){ $('argument-hint').hidden=!argumentHint;$('argument-hint').textContent=argumentHint?t('calculator.argumentHint',argumentHint):''; }
function pressKey(key){
  if(key.id==='equals'){run();return;}
  if(key.id==='clear'){clear();return;}
  const input=$('expression');let start=input.selectionStart,end=input.selectionEnd,text=key.token;
  const selected=input.value.slice(start,end);
  if(key.id==='backspace'){
    if(start===end&&start>0)start-=Array.from(input.value.slice(0,start)).at(-1).length;
    text='';
  } else if(key.id==='negate'){
    if(start===end){start=0;end=input.value.length;}
    const value=input.value.slice(start,end);text=value?`-(${value})`:'-';
  } else if(key.fn){
    text=selected?`${key.token}${selected}${key.binary?',':')'}`:key.token;
  } else if(selected&&['power','factorial'].includes(key.id))text=`(${selected})${key.token}`;
  input.setRangeText(text,start,end,'end');
  argumentHint=key.example?{function:key.label,example:key.example}:undefined;
  renderArgumentHint();invalidate();input.focus();
}
const digit=label=>({id:label,label,token:label,kind:'number'});
const operator=(label,token)=>({id:token,label,token,kind:'operator'});
const fn=(id,label,token,example)=>({id,label,token,fn:true,binary:Boolean(example),example,kind:'function',title:id});
const standard=[
  {id:'clear',label:'AC',kind:'clear',title:'clear'},{id:'backspace',label:'⌫',kind:'function',title:'backspace'},digit('('),digit(')'),
  fn('sqrt','√x','sqrt('),fn('square','x²','square('),operator('%','%'),operator('÷','/'),
  digit('7'),digit('8'),digit('9'),operator('×','*'),
  digit('4'),digit('5'),digit('6'),operator('−','-'),
  digit('1'),digit('2'),digit('3'),operator('+','+'),
  {id:'negate',label:'±',kind:'function',title:'negate'},digit('0'),digit('.'),{id:'equals',label:'=',kind:'equals',title:'calculate'}
];
const scientific=[
  fn('sin','sin','sin('),fn('cos','cos','cos('),fn('tan','tan','tan('),{id:'pi',label:'π',token:'pi',kind:'function',title:'pi'},
  fn('asin','asin','asin('),fn('acos','acos','acos('),fn('atan','atan','atan('),{id:'e',label:'e',token:'e',kind:'function',title:'e'},
  fn('log10','log₁₀','log10('),fn('ln','ln','ln('),fn('logBase','logₐ','log(','log(8, 2)'),{id:'ans',label:'Ans',token:'Ans',kind:'function',title:'ans'},
  fn('cube','x³','cube('),{id:'power',label:'xʸ',token:'^',kind:'function',title:'power'},fn('nthRoot','ⁿ√x','nthRoot(','nthRoot(32, 5)'),fn('cbrt','∛x','cbrt('),
  fn('power10','10ˣ','10^('),fn('exp','eˣ','exp('),{id:'factorial',label:'x!',token:'!',kind:'function',title:'factorial'},fn('reciprocal','1/x','1/('),
  fn('combinations','nCr','combinations(','combinations(5, 2)'),fn('permutations','nPr','permutations(','permutations(5, 2)'),fn('abs','abs','abs('),{id:'comma',label:',',token:',',kind:'function',title:'comma'}
];
for(const [id,keys] of [['keypad',standard],['scientific-keypad',scientific]])for(const key of keys){
  const button=document.createElement('button');button.textContent=key.label;button.dataset.key=key.id;button.className=`calculator-key calculator-key--${key.kind}`;
  if(key.id==='clear')button.id='clear';if(key.id==='equals')button.id='calculate';
  if(key.title){button.dataset.i18nTitle=`calculator.${key.title}`;button.dataset.i18nAriaLabel=`calculator.${key.title}`;}
  button.addEventListener('click',()=>pressKey(key));$(id).append(button);
}
for(const calcMode of ['standard','scientific'])$(`calc-mode-${calcMode}`).addEventListener('click',()=>{
  for(const mode of ['standard','scientific'])$(`calc-mode-${mode}`).setAttribute('aria-pressed',String(mode===calcMode));
  $('scientific-keypad').hidden=calcMode!=='scientific';$('calculator-keyboards').classList.toggle('is-scientific',calcMode==='scientific');
});
$('business-run').addEventListener('click',()=>run(true));$('cancel').addEventListener('click',()=>runner.cancel());
for(const id of ['expression','first','second','mode'])$(id).addEventListener('input',()=>{argumentHint=undefined;renderArgumentHint();invalidate();});
$('angle-unit').addEventListener('change',invalidate);
$('expression').addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(['Enter','='].includes(event.key)){event.preventDefault();run();}
  else if(event.key==='Escape'){event.preventDefault();clear();}
});
for(const id of ['first','second'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter')run(true);});
$('copy').addEventListener('click',()=>{if(result)copyText(result.exact);});
onLanguageChange(()=>{renderHistory();renderContext();renderArgumentHint();});
translateDOM($('tool-root'));
