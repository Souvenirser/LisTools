import {registerContentCheck} from './tools/shared/content-state.js';
import { mountTool, localize, copyText, downloadText } from './tools/shared/page.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import { plannedBytes, speedLevels, speedLevelFor } from './tools/speedtest/core.js';
import { createSpeedTestController } from './tools/speedtest/controller.js';
import './tools/speedtest/style.css';

const root=document.getElementById('tool-root');
root.innerHTML=`
  <section class="page-heading"><div><h1 data-i18n="uiText.saf21bd04"></h1><p data-i18n="uiText.sa3aafdbb"></p></div></section>
  <div class="speed-layout"><section class="tool-card" id="speed-controls">
    <details id="speed-settings" open><summary id="speed-settings-summary" data-i18n="direct.developer.speedSettings"></summary><div class="tool-fields">
      <div class="field"><label for="speed-profile" data-i18n="uiText.s53806f0"></label><select id="speed-profile"><option value="light" data-i18n="uiText.scd431532"></option><option value="standard" data-i18n="uiText.s4f9a1a4d"></option></select></div>
      <div class="field"><label for="speed-unit" data-i18n="uiText.s8695da4e"></label><select id="speed-unit"><option>MB/s</option><option>Mbps</option></select></div>
    </div>
    </details><p class="tool-note" id="speed-budget"></p>
    <p class="tool-note" id="speed-network-notice" data-i18n="direct.developer.speedNetwork"></p>
    <p class="tool-note" data-i18n="uiText.saecdb926"></p>
    <div class="tool-actions"><button class="primary" id="speed-start" data-i18n="uiText.sa751a9cd"></button><button id="speed-cancel" disabled data-i18n="uiText.s35afca3b"></button><button id="speed-clear" data-i18n="uiText.s4a57fc2"></button><button id="speed-copy" disabled data-i18n="uiText.s3c8c0614"></button><button id="speed-download" disabled data-i18n="uiText.s41fa1c79"></button></div>
    <p class="tool-status" id="speed-status" role="status" aria-live="polite"></p><progress id="speed-progress" value="0" max="100" data-i18n-aria-label="uiText.s535d93b"></progress>
  </section>
  <section id="speed-metrics"><div id="speed-primary-metrics" class="speed-metrics"></div>  <section class="tool-card speed-rating" id="speed-rating" aria-labelledby="speed-rating-heading">
    <h2 id="speed-rating-heading" data-i18n="speedtestRating.heading"></h2>
    <p id="speed-rating-waiting" class="tool-note"></p><p id="speed-rating-partial" class="tool-note" data-i18n="speedtestRating.partial" hidden></p>
    <div id="speed-rating-results" aria-live="polite" hidden></div>
    <details id="speed-scale-details"><summary data-i18n="speedtestRating.scaleTitle"></summary>
    <ol id="speed-level-scale">${speedLevels.map(level=>`<li data-level="${level.id}"><img src="./speed-levels/${level.id}.svg" width="34" height="34" alt=""><div><strong></strong><span dir="ltr"></span></div></li>`).join('')}</ol>
    <p class="tool-note" data-i18n="speedtestRating.scaleHint"></p></details>
  </section>
<div id="speed-idle-metrics" class="speed-metrics speed-secondary"></div><details id="speed-loaded-details"><summary data-i18n="uiText.loadedMetrics"></summary><div id="speed-loaded-metrics" class="speed-metrics speed-secondary"></div></details><div class="tool-actions" id="speed-result-actions"></div></section>
  <details class="tool-card speed-chart-card">
    <summary><div class="speed-chart-heading"><h2 data-i18n="uiText.seb894ce3"></h2><div class="speed-chart-legend"><span class="speed-legend-download" data-i18n="uiText.s6964bb19"></span><span class="speed-legend-upload" data-i18n="uiText.s826f7f7c"></span></div></div></summary>
    <div class="speed-chart-frame">
      <div id="speed-chart-unit" dir="ltr"></div><canvas id="speed-chart" role="img"></canvas>
      <p id="speed-chart-empty"><span></span></p><div id="speed-chart-axis" data-i18n="uiText.s616e7c80"></div>
    </div>
    <p class="tool-note" data-i18n="uiText.sc847ed18"></p>
  </details></div>
  <p class="tool-note" data-i18n="uiText.s18bb5cac"></p>`;
mountTool('speedtest');
translateDOM(root);
const $=id=>document.getElementById(id);
const metricLabels=['downloadBps','uploadBps','latencyMs','jitterMs','downloadLatencyMs','downloadJitterMs','uploadLatencyMs','uploadJitterMs'];
let state={status:'idle'};
const speedUnit=()=> $('speed-unit').value;
const convert=value=>value/(speedUnit()==='Mbps'?1e6:8e6);
function renderRatings() {
  const finished=['complete','incomplete'].includes(state.status);
  $('speed-rating-waiting').hidden=finished||state.status==='idle';$('speed-rating-heading').hidden=!finished;
  $('speed-rating-waiting').textContent=t(`speedtestRating.${state.status==='running'?'testing':'waiting'}`);
  $('speed-rating-partial').hidden=state.status!=='incomplete';
  $('speed-rating-results').hidden=!finished;$('speed-primary-metrics').hidden=state.status!=='running';
  $('speed-rating-results').replaceChildren(...(finished?['download','upload'].map(direction=>{
    const bps=state.metrics?.[`${direction}Bps`],level=speedLevelFor(bps),card=document.createElement('div');
    card.className=`speed-rating-card speed-rating-${direction}`;card.dataset.direction=direction;
    if(level){
      card.dataset.level=level.id;const image=document.createElement('img');image.src=`./speed-levels/${level.id}.svg`;image.width=72;image.height=72;image.alt='';card.append(image);
    }else card.classList.add('is-unavailable');
    const content=document.createElement('div'),label=document.createElement('span'),rating=document.createElement('span'),value=document.createElement('strong');rating.className='speed-rating-name';
    label.className='speed-rating-label';label.textContent=t(`speedtestRating.${direction}`);
    rating.textContent=t(`speedtestRating.${level?level.id:'unavailable'}`);
    value.className='speed-rating-value';value.dir='ltr';value.textContent=level?`${convert(bps).toFixed(2)} ${speedUnit()}`:'';
    content.append(label,value,rating);card.append(content);return card;
  }):[]));
  const format=new Intl.NumberFormat(document.documentElement.lang,{maximumFractionDigits:3});
  speedLevels.forEach((level,index)=>{
    const row=$('speed-level-scale').children[index],next=speedLevels[index+1];
    row.querySelector('strong').textContent=t(`speedtestRating.${level.id}`);
    row.querySelector('span').textContent=t(`speedtestRating.${!index?'below':next?'range':'above'}`,{value:format.format(convert(!index?next.minBps:level.minBps)),min:format.format(convert(level.minBps)),max:next?format.format(convert(next.minBps)):'',unit:speedUnit()});
  });
}
function resultSummary(){return {...state,ratings:Object.fromEntries(['download','upload'].map(direction=>[direction,speedLevelFor(state.metrics?.[`${direction}Bps`])?.id??null]))};}
function draw() {
  const canvas=$('speed-chart'),ctx=canvas.getContext('2d');
  const {width,height}=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio || 1;
  if(!width || !height)return;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
  const left=60,right=width-18,top=16,bottom=height-32;
  const all=Object.values(state.series || {}).flat(),peak=Math.max(0,...all.map(convert));
  const roughStep=(peak?peak*1.1:10)/4,magnitude=10**Math.floor(Math.log10(roughStep));
  const step=[1,2,2.5,5,10].map(value=>value*magnitude).find(value=>value>=roughStep),maximum=step*4;
  const count=Math.max(5,...Object.values(state.series || {}).map(values=>values.length)),xAt=index=>left+index*(right-left)/(count-1);
  const format=new Intl.NumberFormat(document.documentElement.lang,{maximumSignificantDigits:3}),style=getComputedStyle(canvas);
  ctx.clearRect(0,0,width,height);ctx.font=`${parseFloat(getComputedStyle(document.documentElement).fontSize)*.875}px system-ui`;ctx.direction='ltr';ctx.textAlign='right';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++) {
    const y=bottom-(bottom-top)*i/4;
    ctx.fillStyle=style.getPropertyValue('--muted');ctx.fillText(format.format(step*i),left-12,y);
    ctx.strokeStyle=style.getPropertyValue('--border');ctx.setLineDash([3,5]);
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
  }
  const ticks=Math.min(count,width<600?4:6);ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let i=0;i<ticks;i++) {
    const index=Math.round(i*(count-1)/(ticks-1)),x=xAt(index);
    ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();
    ctx.fillText(String(index+1),x,bottom+22);
  }
  ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
  for(const [type,color] of [['download','#0d74ce'],['upload','#ce2c31']]) {
    const points=(state.series?.[type] || []).map((value,index)=>[xAt(index),bottom-(bottom-top)*convert(value)/maximum]);
    if(!points.length)continue;
    const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,`${color}28`);gradient.addColorStop(1,`${color}02`);
    ctx.beginPath();ctx.moveTo(points[0][0],bottom);for(const [x,y] of points)ctx.lineTo(x,y);ctx.lineTo(points.at(-1)[0],bottom);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    points.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    for(const [x,y] of points){ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
  }
  $('speed-chart-unit').textContent=speedUnit();
  canvas.setAttribute('aria-label',t('uiText.sdbb3f38a',{p0:speedUnit()}));
  $('speed-chart-empty').hidden=all.length>0;
  $('speed-chart-empty').firstElementChild.textContent=state.status==='running'?t('uiText.sd84f7fb7'):state.status==='idle'?t('uiText.s176420f6'):t('uiText.sb9fe0560');
}
function render(next=state) {
  const completed=['complete','incomplete'].includes(next.status)&&!['complete','incomplete'].includes(state.status);state=next;const running=state.status==='running',hasResult=['complete','incomplete'].includes(state.status);
  if(completed)$('speed-settings').open=false;
  $('speed-start').disabled=running;$('speed-profile').disabled=running;$('speed-cancel').disabled=!running;
  $('speed-copy').disabled=!hasResult;$('speed-download').disabled=!hasResult;
  $('speed-start').textContent=hasResult?t('uiText.s2717a0fd'):t('uiText.sa751a9cd');
  const budget=plannedBytes($('speed-profile').value)/1024**2;
  $('speed-budget').textContent=t('uiText.scf6db0aa',{p0:budget.toFixed(1)});
  $('speed-settings-summary').textContent=hasResult?t('direct.developer.speedSummary',{profile:$('speed-profile').selectedOptions[0].textContent,unit:speedUnit(),budget:budget.toFixed(1)}):t('direct.developer.speedSettings');
  const phases={latency:t('uiText.s99152d25'),download:t('uiText.s6964bb19'),upload:t('uiText.s826f7f7c')};
  const label=running?`${t('uiText.s535d93b')} · ${phases[state.phase]}`:state.status==='complete'?t('uiText.se54758cc'):state.status==='incomplete'?t('uiText.sef726d4b'):t('uiText.s3a32febf');
  const reason=state.reason==='timeout'?t('uiText.se345fc07'):state.reason==='cancelled'?t('uiText.s48e3ebbb'):['network','error'].includes(state.reason)?' · '+t(state.reason==='network'?'refinement.speedNetworkError':'refinement.speedStartError'):state.message?` · ${state.message}`:'';
  $('speed-status').textContent=`${label}${reason}${state.elapsedMs!==undefined?` · ${(state.elapsedMs/1000).toFixed(1)} s · ${t('uiText.s6b1ddb3a')} ${(state.completedBytes/1024**2).toFixed(2)} MiB`:''}`;
  $('speed-progress').value=state.status==='complete'?100:Math.min(99,(state.completedBytes || 0)/(state.plannedBytes || 1)*100);
  $('speed-progress').hidden=!running;
  $('speed-idle-metrics').hidden=state.status==='idle';$('speed-loaded-details').hidden=state.status==='idle';
  const metricCards=metricLabels.map(key=>{
    const card=document.createElement('div');card.className='tool-card';card.dataset.metric=key;const title=document.createElement('span');title.className='tool-note';title.dataset.i18n=`usability.speedtest.${key}`;title.textContent=t(title.dataset.i18n);
    const value=document.createElement('strong'),number=state.metrics?.[key];
    if(number==null)value.className='speed-value-pending';
    value.textContent=number==null?(running?t('uiText.s535d93b'):hasResult?t('uiText.se372e182'):t('uiText.s40941bdb')):key.endsWith('Bps')?`${convert(number).toFixed(2)} ${speedUnit()}`:`${number.toFixed(2)} ms`;
    card.append(title,value);return card;
  });$('speed-primary-metrics').replaceChildren(...metricCards.slice(0,2));$('speed-idle-metrics').replaceChildren(...metricCards.slice(2,4));$('speed-loaded-metrics').replaceChildren(...metricCards.slice(4));renderRatings();draw();
}
const networkDetails=document.createElement('details');networkDetails.className='speed-network-details';networkDetails.innerHTML='<summary data-i18n="experience.networkDetails"></summary>';networkDetails.append(document.querySelector('[data-i18n="uiText.saecdb926"]'));$('speed-settings').append($('speed-budget'),$('speed-network-notice'),networkDetails);translateDOM(networkDetails);
$ ('speed-result-actions').append($('speed-copy'),$('speed-download'));
const controller=createSpeedTestController({onState:render});
$('speed-start').addEventListener('click',()=>void controller.start($('speed-profile').value));
$('speed-cancel').addEventListener('click',()=>controller.cancel());$('speed-clear').addEventListener('click',()=>controller.clear());
$('speed-profile').addEventListener('change',()=>controller.clear());$('speed-unit').addEventListener('change',()=>render());
$('speed-copy').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))void copyText(JSON.stringify(resultSummary(),null,2));});
$('speed-download').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))downloadText(JSON.stringify(resultSummary(),null,2),'listools-speedtest.json','application/json');});
new ResizeObserver(draw).observe($('speed-chart'));window.addEventListener('resize',draw);
onLanguageChange(()=>{localize();render();});window.addEventListener('pagehide',()=>controller.dispose());render();

registerContentCheck(()=>state.status!=='idle');

const ratingScope=document.createElement('p');ratingScope.className='tool-note';ratingScope.dataset.i18n='refinement.speedScope';$('speed-rating').append(ratingScope);ratingScope.textContent=t('refinement.speedScope');
