import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

async function open(page,theme='light'){
 await page.addInitScript(theme=>{
  localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));
  // Keep the actual worker and response; delay delivery so pending frames are deterministic.
  window.cronRequests=0;const Native=window.Worker;
  window.Worker=class extends Native{
   postMessage(data,...rest){if(data.options?.dialect)window.cronRequests++;return super.postMessage(data,...rest);}
   set onmessage(handler){super.onmessage=event=>{if(!event.data.dates)return handler(event);if(window.holdCron)window.deliverCron=()=>handler(event);else setTimeout(()=>handler(event),120);};}
  };
 },theme);
 await page.goto('/cron.html');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
 await expect(page.locator('#cron-description')).toHaveText('Every 5 minutes');
}
async function disabledExports(page){for(const id of ['cron-copy-dates','cron-download-csv','cron-download-json'])await expect(page.locator('#'+id)).toBeDisabled();}
async function ready(page){await expect(page.locator('#cron-cancel')).toBeDisabled();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await expect(page.locator('#cron-copy-dates')).toBeEnabled();}

for(const theme of ['light','dark'])for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]){
 test(`repeated Cron calculation keeps painted results and geometry at ${viewport.width}x${viewport.height} ${theme}`,async({page,browserName},testInfo)=>{
  await page.setViewportSize(viewport);await open(page,theme);await page.locator('#cron-auto').uncheck();
  await page.locator('#cron-preview-settings summary').click();await page.locator('#cron-reference').fill('2026-01-01T00:00:00Z');await page.locator('#cron-preview-settings summary').click();await page.locator('#cron-run').click();await ready(page);
  await page.locator('#cron-run').scrollIntoViewIfNeeded();
  if(browserName==='webkit')await page.locator('#cron-run').focus();
  for(let repeat=0;repeat<3;repeat++){
   await page.evaluate(()=>{
    window.cronFrames=[];const start=performance.now();
    function sample(){const card=document.querySelector('[aria-labelledby="cron-result-title"]').getBoundingClientRect(),run=document.querySelector('#cron-run').getBoundingClientRect();window.cronFrames.push({time:performance.now()-start,top:card.top,height:card.height,runX:run.x,runY:run.y,mainScroll:document.querySelector('main').scrollTop,pageScroll:scrollY,rows:document.querySelector('#cron-dates tbody').rows.length,description:document.querySelector('#cron-description').textContent,next:document.querySelector('#cron-next').textContent,context:document.querySelector('#cron-result-context').textContent});if(performance.now()-start<550)requestAnimationFrame(sample);}sample();
   });
   if(browserName==='webkit')await page.locator('#cron-run').press('Enter');else await page.locator('#cron-run').click();await page.waitForTimeout(600);
   const frames=await page.evaluate(()=>window.cronFrames);await testInfo.attach('cron-repeat-'+repeat,{body:JSON.stringify(frames),contentType:'application/json'});
   expect(frames.length).toBeGreaterThan(10);
   for(const field of ['rows','description','next','context'])expect(frames.every(frame=>frame[field]===frames[0][field]),field+' must remain painted throughout the request').toBe(true);
   for(const field of ['top','height','runX','runY','mainScroll','pageScroll'])expect(Math.max(...frames.map(frame=>frame[field]))-Math.min(...frames.map(frame=>frame[field])),field+' must not jump during a repeat request').toBeLessThanOrEqual(1);
   await expect(page.locator('#cron-run')).toBeFocused();await ready(page);
  }
 });
}

test('Cron input changes invalidate old exports in both manual and auto modes',async({page,context,browserName})=>{
 await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);await open(page);
 await page.locator('#cron-auto').uncheck();await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').fill('0 9 * * *');await page.locator('#cron-expression').press('Enter');await ready(page);
 await page.locator('#cron-expression').fill('0 10 * * *');await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').press('Enter');await ready(page);await expect(page.locator('#cron-description')).toHaveText('At 10:00');
 await page.locator('#cron-auto').check();await ready(page);await page.locator('#cron-expression').fill('0 11 * * *');await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await ready(page);await expect(page.locator('#cron-description')).toHaveText('At 11:00');
 await page.locator('#cron-copy-dates').click();expect((await page.evaluate(()=>navigator.clipboard.readText())).split('\n')).toHaveLength(10);
});

test('Cron pending presentation disables exports and clears on cancel, timeout and invalid input before retry',async({page})=>{
 await open(page);await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.deliverCron)).toBe('function');
 await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await disabledExports(page);await expect(page.locator('#cron-dates tbody button').first()).toBeDisabled();
 await expect(page.locator('[aria-labelledby="cron-result-title"]')).toHaveAttribute('aria-busy','true');
 await page.locator('#cron-cancel').click();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await disabledExports(page);
 await page.evaluate(()=>{window.deliverCron();window.holdCron=false;});await page.waitForTimeout(100);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-run').click();await ready(page);
 await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible({timeout:4000});await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await disabledExports(page);
 await page.evaluate(()=>{window.holdCron=false;});await page.locator('#cron-run').click();await ready(page);
 await page.locator('#cron-auto').uncheck();await page.locator('#cron-expression').fill('61 * * * *');await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible();await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').fill('*/5 * * * *');await page.locator('#cron-expression').press('Enter');await ready(page);await expect(page.locator('#cron-error')).toBeHidden();
});

test('Cron retained presentation changes language during pending work without restarting it',async({page})=>{
 await open(page);await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();await expect.poll(()=>page.evaluate(()=>typeof window.deliverCron)).toBe('function');const requests=await page.evaluate(()=>window.cronRequests);
 await selectLanguage(page,'ru');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await expect(page.locator('#cron-description')).not.toContainText('Every');await disabledExports(page);
 expect(await page.evaluate(()=>window.cronRequests)).toBe(requests);await page.evaluate(()=>window.deliverCron());await ready(page);await expect(page.locator('#cron-status')).toHaveText('Найдено запусков: 10');
});
