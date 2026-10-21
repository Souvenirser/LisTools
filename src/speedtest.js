import { mountTool, tr, localize, copyText, downloadText } from './tools/shared/page.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import { plannedBytes, speedLevels, speedLevelFor } from './tools/speedtest/core.js';
import { createSpeedTestController } from './tools/speedtest/controller.js';
import './tools/speedtest/style.css';

const root=document.getElementById('tool-root');
root.innerHTML=`
  <section class="page-heading"><div><h1 data-zh="网速测试" data-en="Speed test"></h1><p data-zh="手动测量到公共节点的下载、上传与 HTTP 延迟。" data-en="Manually measure download, upload and HTTP latency to a public node."></p></div></section>
  <div class="speed-layout"><section class="tool-card" id="speed-controls">
    <div class="tool-fields">
      <div class="field"><label for="speed-profile" data-zh="测试档位" data-en="Test profile"></label><select id="speed-profile"><option value="light" data-zh="轻量 · 约 14.4 MiB" data-en="Light · about 14.4 MiB"></option><option value="standard" data-zh="标准 · 约 166.4 MiB" data-en="Standard · about 166.4 MiB"></option></select></div>
      <div class="field"><label for="speed-unit" data-zh="速度单位" data-en="Speed unit"></label><select id="speed-unit"><option>MB/s</option><option>Mbps</option></select></div>
    </div>
    <p class="tool-note" id="speed-budget"></p>
    <p class="tool-note" data-zh="仅点击开始后连接 speed.cloudflare.com。服务会接收到连接 IP 和合成测试流量；不上传其他工具数据，不发送凭证或额外结果报告。公共节点不可用时直接报错。" data-en="Only Start connects to speed.cloudflare.com. The service receives your connection IP and synthetic test traffic. No other tool data, credentials or additional result reports are sent. Node failures are reported directly."></p>
    <div class="tool-actions"><button class="primary" id="speed-start" data-zh="开始测速" data-en="Start test"></button><button id="speed-cancel" disabled data-zh="取消" data-en="Cancel"></button><button id="speed-clear" data-zh="清空" data-en="Clear"></button><button id="speed-copy" disabled data-zh="复制摘要" data-en="Copy summary"></button><button id="speed-download" disabled data-zh="下载 JSON" data-en="Download JSON"></button></div>
    <p class="tool-status" id="speed-status" role="status" aria-live="polite"></p><progress id="speed-progress" value="0" max="100" aria-label="Test progress"></progress>
  </section>
  <section class="tool-card speed-rating" id="speed-rating" aria-labelledby="speed-rating-heading">
    <h2 id="speed-rating-heading" data-i18n="speedtestRating.heading"></h2>
    <p id="speed-rating-waiting" class="tool-note"></p><p id="speed-rating-partial" class="tool-note" data-i18n="speedtestRating.partial" hidden></p>
    <div id="speed-rating-results" aria-live="polite" hidden></div>
    <h3 data-i18n="speedtestRating.scaleTitle"></h3>
    <ol id="speed-level-scale">${speedLevels.map(level=>`<li data-level="${level.id}"><img src="./speed-levels/${level.id}.svg" width="34" height="34" alt=""><div><strong></strong><span dir="ltr"></span></div></li>`).join('')}</ol>
    <p class="tool-note" data-i18n="speedtestRating.scaleHint"></p>
  </section>
  <section id="speed-metrics" class="speed-metrics"></section>
  <section class="tool-card speed-chart-card">
    <div class="speed-chart-heading"><h2 data-zh="速度样本" data-en="Speed samples"></h2><div class="speed-chart-legend"><span class="speed-legend-download" data-zh="下载" data-en="Download"></span><span class="speed-legend-upload" data-zh="上传" data-en="Upload"></span></div></div>
    <div class="speed-chart-frame">
      <div id="speed-chart-unit" dir="ltr"></div><canvas id="speed-chart" role="img"></canvas>
      <p id="speed-chart-empty"><span></span></p><div id="speed-chart-axis" data-zh="样本序号" data-en="Sample number"></div>
    </div>
    <p class="tool-note" data-zh="每个点代表一次已完成请求的速度样本；下载与上传按各自的样本序号对齐。" data-en="Each point is a speed sample from a completed request. Download and upload use their own sample numbers."></p>
  </section></div>
  <p class="tool-note" data-zh="显示已完成样本的业务负载，不包含协议开销、失败请求、在途数据或重传。轻量档可能无法充分测量高速连接。延迟是 HTTP 测量，不是 ICMP Ping；不提供 UDP 丢包率。" data-en="Completed sample payload excludes protocol overhead, failed requests, in-flight data and retransmissions. Light mode may not fully measure fast connections. Latency uses HTTP, not ICMP ping. UDP packet loss is not measured."></p>`;
mountTool('speedtest');
translateDOM(root);
const $=id=>document.getElementById(id);
const metricLabels=[['downloadBps','下载速度','Download'],['uploadBps','上传速度','Upload'],['latencyMs','空闲 HTTP 延迟','Idle HTTP latency'],['jitterMs','空闲抖动','Idle jitter'],['downloadLatencyMs','下载负载延迟','Download loaded latency'],['downloadJitterMs','下载负载抖动','Download loaded jitter'],['uploadLatencyMs','上传负载延迟','Upload loaded latency'],['uploadJitterMs','上传负载抖动','Upload loaded jitter']];
let state={status:'idle'};
const speedUnit=()=> $('speed-unit').value;
const convert=value=>value/(speedUnit()==='Mbps'?1e6:8e6);
function renderRatings() {
  const finished=['complete','incomplete'].includes(state.status);
  $('speed-rating-waiting').hidden=finished;
  $('speed-rating-waiting').textContent=t(`speedtestRating.${state.status==='running'?'testing':'waiting'}`);
  $('speed-rating-partial').hidden=state.status!=='incomplete';
  $('speed-rating-results').hidden=!finished;
  $('speed-rating-results').replaceChildren(...(finished?['download','upload'].map(direction=>{
    const bps=state.metrics?.[`${direction}Bps`],level=speedLevelFor(bps),card=document.createElement('div');
    card.className=`speed-rating-card speed-rating-${direction}`;card.dataset.direction=direction;
    if(level){
      card.dataset.level=level.id;const image=document.createElement('img');image.src=`./speed-levels/${level.id}.svg`;image.width=72;image.height=72;image.alt='';card.append(image);
    }else card.classList.add('is-unavailable');
    const content=document.createElement('div'),label=document.createElement('span'),rating=document.createElement('strong'),value=document.createElement('span');
    label.className='speed-rating-label';label.textContent=t(`speedtestRating.${direction}`);
    rating.textContent=t(`speedtestRating.${level?level.id:'unavailable'}`);
    value.className='speed-rating-value';value.dir='ltr';value.textContent=level?`${convert(bps).toFixed(2)} ${speedUnit()}`:'';
    content.append(label,rating,value);card.append(content);return card;
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
  ctx.clearRect(0,0,width,height);ctx.font='12px system-ui';ctx.direction='ltr';ctx.textAlign='right';ctx.textBaseline='middle';
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
  canvas.setAttribute('aria-label',tr(`下载与上传速度样本；纵轴 ${speedUnit()}，横轴样本序号。`,`Download and upload speed samples. Vertical axis: ${speedUnit()}. Horizontal axis: sample number.`));
  $('speed-chart-empty').hidden=all.length>0;
  $('speed-chart-empty').firstElementChild.textContent=state.status==='running'?tr('正在采集速度样本…','Collecting speed samples…'):state.status==='idle'?tr('点击“开始测速”查看速度曲线','Start a test to see the speed chart'):tr('本次未获得速度样本，可重新测速','No speed samples recorded. Try another test.');
}
function render(next=state) {
  state=next;const running=state.status==='running',hasResult=['complete','incomplete'].includes(state.status);
  $('speed-start').disabled=running;$('speed-profile').disabled=running;$('speed-cancel').disabled=!running;
  $('speed-copy').disabled=!hasResult;$('speed-download').disabled=!hasResult;
  $('speed-start').textContent=hasResult?tr('重新测速','Test again'):tr('开始测速','Start test');
  const budget=plannedBytes($('speed-profile').value)/1024**2;
  $('speed-budget').textContent=tr(`计划最多约 ${budget.toFixed(1)} MiB 业务负载；重传等可能增加实际流量。最长 120 秒，可随时取消。`,`Planned payload up to about ${budget.toFixed(1)} MiB; retransmissions may add traffic. Maximum 120 seconds. Cancel at any time.`);
  const phases={latency:tr('空闲延迟','Idle latency'),download:tr('下载','Download'),upload:tr('上传','Upload')};
  const label=running?`${tr('正在测试','Testing')} · ${phases[state.phase]}`:state.status==='complete'?tr('测试已完成','Test complete'):state.status==='incomplete'?tr('测试未完成','Test incomplete'):tr('等待手动开始','Ready for manual start');
  const reason=state.reason==='timeout'?tr(' · 已超时',' · Timed out'):state.reason==='cancelled'?tr(' · 已取消',' · Cancelled'):state.message?` · ${state.message}`:'';
  $('speed-status').textContent=`${label}${reason}${state.elapsedMs!==undefined?` · ${(state.elapsedMs/1000).toFixed(1)} s · ${tr('已完成样本负载','Completed sample payload')} ${(state.completedBytes/1024**2).toFixed(2)} MiB`:''}`;
  $('speed-progress').value=state.status==='complete'?100:Math.min(99,(state.completedBytes || 0)/(state.plannedBytes || 1)*100);
  $('speed-metrics').replaceChildren(...metricLabels.map(([key,zh,en])=>{
    const card=document.createElement('div');card.className='tool-card';const title=document.createElement('span');title.className='tool-note';title.textContent=tr(zh,en);
    const value=document.createElement('strong'),number=state.metrics?.[key];
    if(number==null)value.className='speed-value-pending';
    value.textContent=number==null?(running?tr('测速中','Testing'):hasResult?tr('未测得','Not measured'):tr('待测速','Ready to test')):key.endsWith('Bps')?`${convert(number).toFixed(2)} ${speedUnit()}`:`${number.toFixed(2)} ms`;
    card.append(title,value);return card;
  }));renderRatings();draw();
}
const controller=createSpeedTestController({onState:render});
$('speed-start').addEventListener('click',()=>void controller.start($('speed-profile').value));
$('speed-cancel').addEventListener('click',()=>controller.cancel());$('speed-clear').addEventListener('click',()=>controller.clear());
$('speed-profile').addEventListener('change',()=>controller.clear());$('speed-unit').addEventListener('change',()=>render());
$('speed-copy').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))void copyText(JSON.stringify(resultSummary(),null,2));});
$('speed-download').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))downloadText(JSON.stringify(resultSummary(),null,2),'listools-speedtest.json','application/json');});
new ResizeObserver(draw).observe($('speed-chart'));window.addEventListener('resize',draw);
onLanguageChange(()=>{localize();render();});window.addEventListener('pagehide',()=>controller.dispose());render();
