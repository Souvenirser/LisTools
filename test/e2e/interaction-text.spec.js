import {readFile,writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';

// Slow the real worker handler so pending spans rendered frames; retain its real result.
async function delayTextWorker(page){
 await page.route(/\/(?:src\/tools\/text\/worker\.js|assets\/worker-[^/?]+\.js)(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+"\nconst originalHandler=self.onmessage;self.onmessage=async event=>{await new Promise(resolve=>setTimeout(resolve,180));return originalHandler(event);};"});});
}
async function sampleGeometry(page){
 await page.evaluate(()=>{
  window.textGeometry=[];window.sampleTextGeometry=true;
  const sample=()=>{const read=selector=>{const box=document.querySelector(selector).getBoundingClientRect();return {top:box.top,left:box.left,height:box.height};};window.textGeometry.push({time:performance.now(),state:document.querySelector('#tool-status').dataset.taskState||'idle',run:read('#text-run'),selector:read('#text-lines'),controls:read('.text-workspace-controls'),editor:read('.editor-workspace'),windowScroll:scrollY,mainScroll:document.querySelector('main').scrollTop});};
  new MutationObserver(()=>{if(window.sampleTextGeometry)sample();}).observe(document.querySelector('#tool-status'),{attributes:true,childList:true,subtree:true});
  function frame(){if(!window.sampleTextGeometry)return;sample();requestAnimationFrame(frame);}sample();requestAnimationFrame(frame);
 });
}
for(const theme of ['light','dark'])for(const viewport of [{width:1440,height:900},{width:390,height:844}])test(`repeated text runs keep every rendered control position stable in ${theme} at ${viewport.width}px`,async({page},testInfo)=>{
 await page.setViewportSize(viewport);await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({version:1,theme}));},theme);await delayTextWorker(page);await page.goto('/text.html');
 // Preload source without scheduling auto-run; this case measures explicit repeated clicks.
 await page.locator('#text-run').scrollIntoViewIfNeeded();await page.locator('#text-input').evaluate(node=>{node.value='Alice\nBob\nAlice';});await sampleGeometry(page);
 const reader=await page.locator('#text-input').boundingBox();expect(reader.height).toBeGreaterThanOrEqual(240);if(viewport.width===390){const area=await page.locator('.workspace-action-area').boundingBox();expect(Math.min(viewport.height,area.y)-Math.max(0,reader.y),'visible input height').toBeGreaterThanOrEqual(120);}
 for(let run=0;run<4;run++){
  await page.locator('#text-run').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','pending');await expect(page.locator('#tool-status')).toBeVisible();await expect(page.locator('#tool-status')).toContainText(/processing/i);await expect(page.locator('#text-cancel')).toBeEnabled();expect(await page.locator('#text-run').isDisabled()).toBe(true);await expect(page.locator('#text-run')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','ready');await expect(page.locator('#text-result')).toHaveValue('Alice\nBob');await expect(page.locator('#text-cancel')).toBeDisabled();
 }
 const samples=await page.evaluate(()=>{window.sampleTextGeometry=false;return window.textGeometry;});const samplePath=testInfo.outputPath('text-geometry.json');await writeFile(samplePath,JSON.stringify(samples,null,2));await testInfo.attach('text-geometry',{path:samplePath,contentType:'application/json'});
 expect(samples.filter(sample=>sample.state==='pending').length).toBeGreaterThanOrEqual(8);expect(new Set(samples.map(sample=>sample.state))).toEqual(new Set(['idle','pending','ready']));
 for(const target of ['run','selector','controls','editor']){const tops=samples.map(sample=>sample[target].top);expect(Math.max(...tops)-Math.min(...tops),target+' vertical travel').toBeLessThanOrEqual(1);}
 for(const target of ['windowScroll','mainScroll']){const positions=samples.map(sample=>sample[target]);expect(Math.max(...positions)-Math.min(...positions),target+' travel').toBeLessThanOrEqual(1);}
});

test('text keeps cancellation, neutral no-match results and complete downloads',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('listools-language','en'));await delayTextWorker(page);await page.goto('/text.html');
 await page.locator('#text-input').fill('Alice\nBob\nAlice');await page.locator('#text-run').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','pending');await page.locator('#text-cancel').click();await expect(page.locator('#tool-status')).toContainText(/cancelled/i);await page.waitForTimeout(250);await expect(page.locator('#text-result')).toHaveValue('');await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','cancelled');
 await chooseTask(page,'text','extract');await page.locator('#text-input').fill('no contact details');await page.locator('#text-run').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','ready');await expect(page.locator('#text-operation-summary')).toHaveAttribute('data-state','empty');await expect(page.locator('#text-result')).toHaveValue('');await expect(page.locator('#tool-status')).not.toHaveClass(/is-error/);
 await chooseTask(page,'text','case');await page.locator('#text-case').selectOption('upper');const input='a'.repeat(1024*1024+17);await page.locator('#text-input').fill(input);await page.locator('#text-run').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','ready');expect((await page.locator('#text-result').inputValue()).length).toBe(1024*1024);await expect(page.locator('#text-result-note')).toContainText(/preview/i);
 const downloading=page.waitForEvent('download');await page.locator('#text-download').click();const download=await downloading;expect(download.suggestedFilename()).toBe('text-result.txt');expect(await readFile(await download.path(),'utf8')).toBe('A'.repeat(1024*1024+17));
});
