import { mountTool, tr, localize, copyText, downloadText } from './tools/shared/page.js';
import { onLanguageChange } from './i18n.js';
import { plannedBytes } from './tools/speedtest/core.js';
import { createSpeedTestController } from './tools/speedtest/controller.js';
import './tools/speedtest/style.css';

const root=document.getElementById('tool-root');
root.innerHTML=`
  <section class="page-heading"><div><h1 data-zh="网速测试" data-en="Speed test"></h1><p data-zh="手动测量到公共节点的下载、上传与 HTTP 延迟。" data-en="Manually measure download, upload and HTTP latency to a public node."></p></div></section>
  <section class="tool-card">
    <div class="tool-fields">
      <div class="field"><label for="speed-profile" data-zh="测试档位" data-en="Test profile"></label><select id="speed-profile"><option value="light" data-zh="轻量 · 约 14.4 MiB" data-en="Light · about 14.4 MiB"></option><option value="standard" data-zh="标准 · 约 166.4 MiB" data-en="Standard · about 166.4 MiB"></option></select></div>
      <div class="field"><label for="speed-unit" data-zh="速度单位" data-en="Speed unit"></label><select id="speed-unit"><option>Mbps</option><option>MB/s</option></select></div>
    </div>
    <p class="tool-note" id="speed-budget"></p>
    <p class="tool-note" data-zh="仅点击开始后连接 speed.cloudflare.com。服务会接收到连接 IP 和合成测试流量；不上传其他工具数据，不发送凭证或额外结果报告。公共节点不可用时直接报错。" data-en="Only Start connects to speed.cloudflare.com. The service receives your connection IP and synthetic test traffic. No other tool data, credentials or additional result reports are sent. Node failures are reported directly."></p>
    <div class="tool-actions"><button class="primary" id="speed-start" data-zh="开始测速" data-en="Start test"></button><button id="speed-cancel" disabled data-zh="取消" data-en="Cancel"></button><button id="speed-clear" data-zh="清空" data-en="Clear"></button><button id="speed-copy" disabled data-zh="复制摘要" data-en="Copy summary"></button><button id="speed-download" disabled data-zh="下载 JSON" data-en="Download JSON"></button></div>
    <p class="tool-status" id="speed-status" role="status" aria-live="polite"></p><progress id="speed-progress" value="0" max="100" aria-label="Test progress"></progress>
  </section>
  <section id="speed-metrics" class="speed-metrics"></section>
  <section class="tool-card"><h2 data-zh="速度样本" data-en="Speed samples"></h2><canvas id="speed-chart" role="img" aria-label="Download and upload speed samples"></canvas><p class="tool-note" data-zh="蓝色：下载；红色：上传。横轴为各方向样本序号，纵轴随所选速度单位变化。" data-en="Blue: download. Red: upload. Horizontal axis: sample index per direction. Vertical axis: selected speed unit."></p></section>
  <p class="tool-note" data-zh="显示已完成样本的业务负载，不包含协议开销、失败请求、在途数据或重传。轻量档可能无法充分测量高速连接。延迟是 HTTP 测量，不是 ICMP Ping；不提供 UDP 丢包率。" data-en="Completed sample payload excludes protocol overhead, failed requests, in-flight data and retransmissions. Light mode may not fully measure fast connections. Latency uses HTTP, not ICMP ping. UDP packet loss is not measured."></p>`;
mountTool('speedtest');
const $=id=>document.getElementById(id);
const metricLabels=[['downloadBps','下载速度','Download'],['uploadBps','上传速度','Upload'],['latencyMs','空闲 HTTP 延迟','Idle HTTP latency'],['jitterMs','空闲抖动','Idle jitter'],['downloadLatencyMs','下载负载延迟','Download loaded latency'],['downloadJitterMs','下载负载抖动','Download loaded jitter'],['uploadLatencyMs','上传负载延迟','Upload loaded latency'],['uploadJitterMs','上传负载抖动','Upload loaded jitter']];
let state={status:'idle'};
const speedUnit=()=> $('speed-unit').value;
const convert=value=>value/(speedUnit()==='Mbps'?1e6:8e6);
function draw() {
  const canvas=$('speed-chart'),ctx=canvas.getContext('2d');
  const {width,height}=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio || 1;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
  const left=80,right=width-10,bottom=height-20;
  const all=Object.values(state.series || {}).flat(),maximum=Math.max(1,...all);
  ctx.clearRect(0,0,width,height);ctx.font='12px system-ui';ctx.fillStyle='#60646c';
  ctx.fillText(`${convert(maximum).toFixed(2)} ${speedUnit()}`,10,16);ctx.fillText('0',10,height-10);
  ctx.strokeStyle='#d9d9e0';ctx.beginPath();ctx.moveTo(left,20);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();
  for(const [type,color] of [['download','#0d74ce'],['upload','#ce2c31']]) {
    const values=state.series?.[type] || [];ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
    values.forEach((value,i)=>{const x=left+i*(right-left-10)/Math.max(1,values.length-1),y=bottom-(bottom-30)*value/maximum;i?ctx.lineTo(x,y):ctx.moveTo(x,y);ctx.fillStyle=color;ctx.fillRect(x-2,y-2,4,4);});ctx.stroke();
  }
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
    const value=document.createElement('strong'),number=state.metrics?.[key];value.textContent=number==null?tr('样本不足','Insufficient samples'):key.endsWith('Bps')?`${convert(number).toFixed(2)} ${speedUnit()}`:`${number.toFixed(2)} ms`;
    card.append(title,value);return card;
  }));draw();
}
const controller=createSpeedTestController({onState:render});
$('speed-start').addEventListener('click',()=>void controller.start($('speed-profile').value));
$('speed-cancel').addEventListener('click',()=>controller.cancel());$('speed-clear').addEventListener('click',()=>controller.clear());
$('speed-profile').addEventListener('change',()=>controller.clear());$('speed-unit').addEventListener('change',()=>render());
$('speed-copy').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))void copyText(JSON.stringify(state,null,2));});
$('speed-download').addEventListener('click',()=>{if(['complete','incomplete'].includes(state.status))downloadText(JSON.stringify(state,null,2),'listools-speedtest.json','application/json');});
new ResizeObserver(draw).observe($('speed-chart'));window.addEventListener('resize',draw);
onLanguageChange(()=>{localize();render();});window.addEventListener('pagehide',()=>controller.dispose());render();
