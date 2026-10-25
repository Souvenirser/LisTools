import { test, expect } from '@playwright/test';
import { readdir, stat, readFile } from 'node:fs/promises';
import { selectLanguage } from './language-helpers.js';

async function fixture(page,{download=120e6,upload=55e6}={}){
  const chunks=await Promise.all((await readdir('dist/assets')).filter(name=>/^speedtest-.*\.js$/.test(name)).map(async name=>({name,size:(await stat(`dist/assets/${name}`)).size})));
  const sdk=chunks.sort((a,b)=>b.size-a.size)[0].name;
  await page.route(`**/assets/${sdk}`,route=>route.fulfill({contentType:'application/javascript',body:`export default class {
    results={getSummary:()=>({download:${download},upload:${upload},latency:24,jitter:3}),
      getDownloadBandwidthPoints:()=>${download===null?'[]':`[{bps:${download},duration:20,bytes:1024}]`},
      getUploadBandwidthPoints:()=>${upload===null?'[]':`[{bps:${upload},duration:20,bytes:1024}]`},getUnloadedLatencyPoints:()=>[24,27]};
    play(){this.onResultsChange();addEventListener('speedtest-fixture-finish',()=>this.onFinish(),{once:true});} pause(){}
  }`}));
}

test('completed speed tests show separate illustrated download and upload levels',async({page})=>{
  const external=[];page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
  await fixture(page);await page.goto('/speedtest.html');await selectLanguage(page,'zh-Hans');
  await expect(page.locator('details.speed-chart-card')).toHaveCount(1);await expect(page.locator('details.speed-chart-card')).not.toHaveAttribute('open');
  await expect(page.locator('#speed-rating-results')).toBeHidden();await expect(page.locator('#speed-level-scale li')).toHaveCount(7);
  await page.locator('#speed-start').click();await expect(page.locator('#speed-rating-results')).toBeHidden();
  await expect(page.locator('#speed-metrics strong').first()).toHaveText('15.00 MB/s');
  await page.evaluate(()=>dispatchEvent(new Event('speedtest-fixture-finish')));
  const down=page.locator('[data-direction="download"]'),up=page.locator('[data-direction="upload"]');
  await expect(down).toHaveAttribute('data-level','train');await expect(down).toContainText('高铁');await expect(page.locator('#speed-primary-metrics')).toBeHidden();await expect(page.locator('#speed-metrics').getByText('15.00 MB/s',{exact:true}).filter({visible:true})).toHaveCount(1);await expect(up).toHaveAttribute('data-level','car');await expect(up).toContainText('汽车');
  await expect(page.locator('#speed-level-scale [data-level="bicycle"] span')).toHaveText('0.125–<0.625 MB/s');
  for(const card of [down,up])expect(await card.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await page.locator('#speed-settings-summary').click();await page.locator('#speed-unit').selectOption('Mbps');await expect(down).toHaveAttribute('data-level','train');await expect(down).toContainText('120.00 Mbps');
  await selectLanguage(page,'ja');await expect(down).toHaveAttribute('data-level','train');await expect(down).not.toContainText('speedtestRating.');
  const downloading=page.waitForEvent('download');await page.locator('#speed-download').click();const download=await downloading;
  const summary=JSON.parse(await readFile(await download.path(),'utf8'));expect(summary.ratings).toEqual({download:'train',upload:'car'});expect(summary.metrics.downloadBps).toBe(120e6);
  await page.locator('#speed-start').click();await expect(page.locator('#speed-rating-results')).toBeHidden();await page.locator('#speed-clear').click();await expect(page.locator('#speed-rating-results')).toBeHidden();
  expect(external).toEqual([]);
});

test('partial tests never rate an unavailable measurement as a slow connection',async({page})=>{
  await fixture(page,{download:8e6,upload:null});await page.goto('/speedtest.html');await page.locator('#speed-start').click();await expect(page.locator('#speed-metrics strong').first()).toHaveText('1.00 MB/s');await page.locator('#speed-cancel').click();
  await expect(page.locator('#speed-rating-partial')).toBeVisible();
  await expect(page.locator('[data-direction="download"]')).toHaveAttribute('data-level','motorcycle');
  const up=page.locator('[data-direction="upload"]');await expect(up).not.toHaveAttribute('data-level',/.+/);await expect(up.locator('img')).toHaveCount(0);
  await expect(up).not.toContainText('Walking');
});

test('speed page fills wide screens and keeps rating pictures inside narrow RTL screens',async({page})=>{
  await page.setViewportSize({width:2550,height:1107});await page.goto('/speedtest.html');
  const root=await page.locator('#tool-root').boundingBox(),panel=await page.locator('#speed-rating').boundingBox(),controls=await page.locator('#speed-controls').boundingBox();
  expect(root.width).toBe(1920);expect(panel.width).toBe(controls.width);expect(panel.y).toBeGreaterThan(controls.y+controls.height);expect(Math.abs(root.x-(2550-1920)/2)).toBeLessThanOrEqual(1);
  await selectLanguage(page,'ar');
  for(const width of [640,320]){
    await page.setViewportSize({width,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.locator('#speed-scale-details summary').click();for(const image of await page.locator('#speed-level-scale img').all())expect(await image.evaluate(element=>element.complete&&element.naturalWidth>0)).toBe(true);
  }
});
