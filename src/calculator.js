import {registerContentCheck} from './tools/shared/content-state.js';
import { initTool, $, clearStatus, setStatus, taskRunner } from './tools/shared/office.js';
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
      <select id="angle-unit"><option value="deg">DEG</option><option value="rad">RAD</option></select>
    </label>
  </div>
  <div class="field"><label for="expression" data-i18n="calculator.expression"></label><input id="expression" dir="ltr" autocomplete="off" spellcheck="false" placeholder="" data-i18n-placeholder="ux.calculatorExample" aria-describedby="expression-hint argument-hint"></div>
  <p id="expression-hint" class="tool-note" data-i18n="calculator.expressionHint"></p>
  <p id="argument-hint" class="tool-note" hidden></p>
  <div class="calculator-display"><label for="result" data-i18n="calculator.result"></label><output id="result" class="numeric-result" dir="ltr" aria-live="polite"></output><span id="result-source" class="tool-note" hidden></span><span id="result-context" class="tool-note" hidden></span></div>
  <p id="approximate" class="tool-note" data-i18n="calculator.approximate" hidden></p>
  <div id="calculator-keyboards" class="calculator-keyboards" dir="ltr"><div id="scientific-keypad" class="calculator-keypad" hidden></div><div id="keypad" class="calculator-keypad"></div></div>
  <div class="tool-actions"><button id="copy" data-i18n="calculator.copy" disabled></button><button id="cancel" data-i18n="calculator.cancel" disabled></button></div>
  <p class="tool-note" data-i18n="calculator.keyboardHint"></p><p id="calculator-precision" class="tool-note" data-i18n="calculator.precision"></p>
  <details><summary data-i18n="calculator.functions"></summary><p class="tool-note" data-i18n="calculator.functionHelp"></p></details>
</section>
<aside class="calculator-sidebar">
  <section class="tool-card"><h2 data-i18n="calculator.history"></h2><p id="history-empty" class="tool-note" data-i18n="calculator.historyEmpty"></p><ul id="history" class="numeric-history"></ul></section>
  <section class="tool-card"><details id="business-details"><summary data-i18n="calculator.business"></summary><div class="field"><label for="mode" data-i18n="calculator.mode"></label><select id="mode">${['growth','discount','share','part','whole'].map(mode=>`<option value="${mode}" data-i18n="calculator.${mode}"></option>`).join('')}</select></div><div class="tool-fields"><div class="field"><label for="first" data-i18n="calculator.first"></label><input id="first" dir="ltr" inputmode="decimal" value="100"></div><div class="field"><label for="second" data-i18n="calculator.second"></label><input id="second" dir="ltr" inputmode="decimal" value="120"></div></div><p id="business-hint" class="tool-note" data-i18n="calculator.businessHint"></p><button id="business-run" class="primary" data-i18n="calculator.calculate"></button><div class="calculator-business-result" id="business-result-panel" hidden><span id="business-result-source" class="tool-note"></span><output id="business-result" class="numeric-result" dir="ltr" aria-live="polite"></output><button id="business-copy" data-i18n="calculator.copy" disabled></button><p id="business-approximate" class="tool-note" data-i18n="calculator.approximate" hidden></p></div></details></section>
</aside>
</div>`);

let result,businessResult,businessMode,ans,argumentHint,resultSource,requestSource,standardResult=false,standardRequest=false,history=[];
const runner=taskRunner(()=>new Worker(new URL('./tools/calculator/worker.js',import.meta.url),{type:'module'}),{
  timeoutMs:2500,
  onResult(state){
    result=state.result;resultSource=requestSource;ans=result.exact;standardResult=standardRequest&&$('calc-mode-standard').getAttribute('aria-pressed')==='true';
    $('result').textContent=(result.approximate?'≈ ':'')+result.display;
    $('approximate').hidden=!result.approximate;$('copy').disabled=false;
    if(requestSource?.mode){businessResult=result;businessMode=requestSource.mode;}
    history.unshift(result);history=history.slice(0,30);renderHistory();renderContext();renderBusinessResult();
  },
  onState(state){$('cancel').disabled=state.status!=='pending';}
});
function renderContext(){
  $('result-source').hidden=!result;
  $('result-source').textContent=result?t(resultSource?.mode?'redesign.businessResult':'redesign.expressionResult',{expression:result.expression,mode:resultSource?.mode?t('calculator.'+resultSource.mode):''}):'';
  $('result-context').hidden=!result?.usesAngle;
  $('result-context').textContent=result?.usesAngle?t(`calculator.${result.context.angleUnit==='deg'?'degrees':'radians'}`):'';
}
function renderBusinessResult(){
  $('business-result-panel').hidden=!businessResult;$('business-result').textContent=businessResult?(businessResult.approximate?'≈ ':'')+businessResult.display:'';
  $('business-result-source').textContent=businessResult?t('redesign.businessResult',{mode:t('calculator.'+businessMode),expression:businessResult.expression}):'';
  $('business-copy').disabled=!businessResult;$('business-approximate').hidden=!businessResult?.approximate;
}
function renderHistory(){
  const toggle=$('calculator-history-toggle');if(toggle)toggle.disabled=!history.length;
  $('history-empty').hidden=history.length>0;
  $('history').replaceChildren(...history.map(item=>{
    const li=document.createElement('li'),button=document.createElement('button');
    const context=item.usesAngle?` · ${item.context.angleUnit.toUpperCase()}`:'';
    button.textContent=`${item.expression} = ${item.approximate?'≈ ':''}${item.display}`;if(context){const note=document.createElement('small');note.textContent=context.slice(3);button.append(note);}
    button.title=t('calculator.reuse');button.dir='ltr';
    button.addEventListener('click',()=>{
      // Successful expressions only contain whitelisted names; also freeze implicit products such as 2Ans.
      $('expression').value=item.context.ans===undefined?item.expression:item.expression.replaceAll('Ans',`(${item.context.ans})`);
      $('angle-unit').value=item.context.angleUnit;invalidate();$('expression').focus();
    });
    li.append(button);return li;
  }));
}
function invalidate(clearBusiness=false){
  if(clearBusiness){businessResult=undefined;renderBusinessResult();}
  const had=Boolean(result);standardResult=standardRequest=false;runner.invalidate();clearStatus({keepStale:true});if(had)setStatus('ux.stale');result=undefined;$('result').textContent=$('expression').value?'':'0';$('copy').disabled=true;$('approximate').hidden=true;renderContext();
}
function run(business=false){
  requestSource=business?{mode:$('mode').value}:undefined;
  if(business){businessResult=undefined;renderBusinessResult();}
  standardResult=false;standardRequest=!business&&$('calc-mode-standard').getAttribute('aria-pressed')==='true';clearStatus();result=undefined;$('copy').disabled=true;$('result').textContent='';$('approximate').hidden=true;renderContext();
  runner.process(business?{mode:$('mode').value,first:$('first').value,second:$('second').value}:{input:$('expression').value,angleUnit:$('angle-unit').value,ans});
}
function clear(){ $('expression').value='';argumentHint=undefined;renderArgumentHint();invalidate();clearStatus();$('expression').focus(); }
function renderArgumentHint(){ $('argument-hint').hidden=!argumentHint;$('argument-hint').textContent=argumentHint?t('calculator.argumentHint',argumentHint):''; }
function pressKey(key){
  if(key.id==='equals'){run();return;}
  if(key.id==='clear'){clear();return;}
  const input=$('expression');
  if(standardResult&&result&&input.selectionStart===input.selectionEnd){
    if(['+','-','*','/','%'].includes(key.id)||key.fn||key.id==='negate')input.value=`(${result.exact})`;
    else if(key.kind==='number')input.value='';
    input.setSelectionRange(input.value.length,input.value.length);
    if(key.fn||key.id==='negate')input.select();
  }
  let start=input.selectionStart,end=input.selectionEnd,text=key.token;
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
  standardResult=standardRequest=false;
  for(const mode of ['standard','scientific'])$(`calc-mode-${mode}`).setAttribute('aria-pressed',String(mode===calcMode));
  document.querySelector('.calculator-layout').dataset.calcMode=calcMode;
  $('scientific-keypad').hidden=calcMode!=='scientific';$('calculator-keyboards').classList.toggle('is-scientific',calcMode==='scientific');
});
$('business-run').addEventListener('click',()=>run(true));$('cancel').addEventListener('click',()=>runner.cancel());
for(const id of ['expression','first','second','mode'])$(id).addEventListener('input',()=>{argumentHint=undefined;renderArgumentHint();invalidate(id!=='expression');});
$('angle-unit').addEventListener('change',()=>invalidate());
$('expression').addEventListener('pointerdown',()=>{standardResult=standardRequest=false;});
$('expression').addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(['Enter','='].includes(event.key)){event.preventDefault();run();}
  else if(event.key==='Escape'){event.preventDefault();clear();}
  else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&$('calc-mode-standard').getAttribute('aria-pressed')==='true'){
    const key=standard.find(key=>key.id===event.key||key.id==='backspace'&&event.key==='Backspace');
    if(key){event.preventDefault();pressKey(key);}
    else if(['ArrowLeft','ArrowRight','Home','End','Delete'].includes(event.key))standardResult=standardRequest=false;
  }
});
for(const id of ['first','second'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter')run(true);});
$('copy').addEventListener('click',()=>{if(result)copyText(result.exact);});
$('business-copy').addEventListener('click',()=>{if(businessResult)copyText(businessResult.exact);});
function renderBusinessLabels(){
  const labels={growth:['Original','New'],discount:['Price','Off'],share:['Part','Whole'],part:['Whole','Percent'],whole:['Part','Percent']}[$('mode').value];
  for(const [index,id]of ['first','second'].entries()){const label=document.querySelector(`label[for="${id}"]`);label.dataset.i18n=$('mode').value==='discount'&&index===1?'direct.daily.discountReduction':'redesign.calculator'+labels[index];label.textContent=t(label.dataset.i18n);}
  $('business-hint').dataset.i18n=$('mode').value==='discount'?'direct.daily.discountHelp':'calculator.businessHint';$('business-hint').textContent=t($('business-hint').dataset.i18n);
}
$('mode').addEventListener('change',renderBusinessLabels);renderBusinessLabels();
onLanguageChange(()=>{$('result').removeAttribute('data-empty');renderHistory();renderContext();renderBusinessResult();renderArgumentHint();renderBusinessLabels();});
translateDOM($('tool-root'));

registerContentCheck(()=>Boolean(result||history.length||['expression','first','second'].some(id=>$(id).value&&$(id).value!==$(id).defaultValue)));

document.querySelector('.calculator-layout').dataset.calcMode='standard';
$('result').after($('copy'));
const display=document.querySelector('.calculator-display'),displayValue=document.createElement('div'),displayStatus=document.createElement('div'),displayContext=document.createElement('div');
displayValue.className='calculator-result-value';displayStatus.className='calculator-status-slot';displayContext.className='calculator-result-meta';
$('result').removeAttribute('data-empty');displayValue.append(...display.childNodes);displayContext.append(displayValue.querySelector('#result-source'),displayValue.querySelector('#result-context'));$('calculator-keyboards').after(displayContext);displayStatus.append($('tool-status'),$('approximate'));display.append(displayValue,displayStatus);

$('result').textContent='0';const calcExample=document.createElement('button');calcExample.id='calculator-example';calcExample.type='button';calcExample.className='quiet';calcExample.dataset.i18n='ux.viewExample';calcExample.textContent=t('ux.viewExample');document.querySelector('.calculator-sidebar').prepend(calcExample);calcExample.onclick=()=>{if(($('expression').value||history.length)&&!confirm(t('office.exampleConfirm')))return;$('expression').value='200 + 10%';invalidate();$('expression').focus();};

const historyCard=$('history').closest('section'),historyToggle=document.createElement('button');historyToggle.id='calculator-history-toggle';historyToggle.type='button';historyToggle.disabled=true;historyToggle.dataset.i18n='calculator.history';historyToggle.textContent=t('calculator.history');historyToggle.setAttribute('aria-expanded','false');
const calcLayout=document.querySelector('.calculator-layout'),sidebar=document.querySelector('.calculator-sidebar');document.querySelector('.tool-heading').append(historyToggle);historyCard.hidden=true;
historyToggle.onclick=()=>{historyCard.hidden=!historyCard.hidden;historyToggle.setAttribute('aria-expanded',String(!historyCard.hidden));calcLayout.classList.toggle('history-open',!historyCard.hidden);};
sidebar.classList.add('calculator-secondary');
