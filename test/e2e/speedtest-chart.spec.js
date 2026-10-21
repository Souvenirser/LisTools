import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';
import { readdir, stat } from 'node:fs/promises';

for(const scale of [1,2])test.describe(`speed samples at ${scale}x pixel density`,()=>{
  test.use({deviceScaleFactor:scale});
  test('canvas keeps native screen resolution when the viewport changes',async({page})=>{
    await page.goto('/speedtest.html');
    for(const width of [1360,640,1600]){
      await page.setViewportSize({width,height:960});
      await expect.poll(()=>page.locator('#speed-chart').evaluate(canvas=>{
        const bounds=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio;
        return canvas.width===Math.round(bounds.width*ratio)&&canvas.height===Math.round(bounds.height*ratio);
      })).toBe(true);
    }
  });
  test('speed results distinguish waiting, running and unavailable values and default to MB/s',async({page})=>{
    const chunks=await Promise.all((await readdir('dist/assets')).filter(name=>/^speedtest-.*\.js$/.test(name)).map(async name=>({name,size:(await stat(`dist/assets/${name}`)).size})));
    const sdk=chunks.sort((a,b)=>b.size-a.size)[0].name;
    await page.route(`**/assets/${sdk}`,route=>route.fulfill({contentType:'application/javascript',body:`export default class {
      results={getSummary:()=>({download:120000000,upload:55000000,latency:20,jitter:2}),
        getDownloadBandwidthPoints:()=>[80000000,120000000,110000000,145000000,125000000].map(bps=>({bps,duration:20,bytes:1024})),
        getUploadBandwidthPoints:()=>[30000000,50000000,45000000].map(bps=>({bps,duration:20,bytes:1024})),
        getUnloadedLatencyPoints:()=>[20,22]};
      play(){this.onResultsChange();addEventListener('speedtest-fixture-finish',()=>this.onFinish(),{once:true});} pause(){}
    }`}));
    await page.addInitScript(()=>{
      const originalClear=CanvasRenderingContext2D.prototype.clearRect,originalText=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='speed-chart')window.speedChartLabels=[];return originalClear.apply(this,args);};
      CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){if(this.canvas.id==='speed-chart')window.speedChartLabels.push({text,x,y});return originalText.call(this,text,x,y,...args);};
    });
    const external=[];page.on('request',request=>{if(request.url().startsWith('https://'))external.push(request.url());});
    await page.goto('/speedtest.html');await selectLanguage(page,'zh-Hans');
    const values=page.locator('#speed-metrics strong');
    await expect(page.locator('#speed-unit')).toHaveValue('MB/s');
    await expect(values).toHaveText(Array(8).fill('待测速'));
    await expect(page.locator('#speed-chart-empty')).toBeVisible();
    await page.locator('#speed-start').click();
    await expect(values.nth(0)).toHaveText('15.00 MB/s');await expect(values.nth(1)).toHaveText('6.88 MB/s');
    await expect(values.nth(4)).toHaveText('测速中');await expect(page.locator('#speed-chart-empty')).toBeHidden();
    await expect(page.locator('#speed-chart-unit')).toHaveText('MB/s');
    await expect(page.locator('#speed-chart-axis')).toHaveText('样本序号');
    expect(await page.locator('#speed-chart').evaluate(canvas=>window.speedChartLabels.filter(label=>label.x>40&&label.y>canvas.getBoundingClientRect().height-30).map(label=>label.text))).toEqual(['1','2','3','4','5']);
    await page.evaluate(()=>dispatchEvent(new Event('speedtest-fixture-finish')));
    await expect(values.nth(4)).toHaveText('未测得');await expect(page.locator('#speed-copy')).toBeEnabled();
    await page.locator('#speed-unit').selectOption('Mbps');
    await expect(values.nth(0)).toHaveText('120.00 Mbps');await expect(values.nth(1)).toHaveText('55.00 Mbps');
    await expect(page.locator('#speed-chart-unit')).toHaveText('Mbps');
    await page.locator('#speed-clear').click();
    await expect(values).toHaveText(Array(8).fill('待测速'));await expect(page.locator('#speed-chart-empty')).toBeVisible();
    await expect(page.locator('#speed-copy')).toBeDisabled();
    await selectLanguage(page,'en');await expect(values).toHaveText(Array(8).fill('Ready to test'));
    expect(external).toEqual([]);
  });
});
