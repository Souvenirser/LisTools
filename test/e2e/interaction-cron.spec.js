import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

async function open(page,theme='light'){
 await page.addInitScript(theme=>{
  localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme,options:{timeZone:'Asia/Shanghai'}}));
  // Keep the actual worker and response; delay delivery so pending frames are deterministic.
  window.cronRequests=0;const Native=window.Worker;
  window.Worker=class extends Native{
   postMessage(data,...rest){if(data.options?.dialect)window.cronRequests++;return super.postMessage(data,...rest);}
   set onmessage(handler){super.onmessage=event=>{if(!event.data.dates)return handler(event);if(window.holdCron)window.deliverCron=()=>handler(event);else setTimeout(()=>handler(event),120);};}
  };
 },theme);
 await page.goto('/cron.html');
 const iframe=page.locator('iframe[data-workspace-active]');await expect(iframe.contentFrame().locator('#cron-dates tbody tr')).toHaveCount(10);
 const frame=await (await iframe.elementHandle()).contentFrame();
 await expect(frame.locator('#cron-description')).toHaveText('Every 5 minutes');return frame;
}
async function disabledExports(page){for(const id of ['cron-copy-dates','cron-download-csv','cron-download-json'])await expect(page.locator('#'+id)).toBeDisabled();}
async function ready(page){await expect(page.locator('#cron-cancel')).toBeDisabled();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await expect(page.locator('#cron-copy-dates')).toBeEnabled();}

function resultGeometry(frame){
 return frame.evaluate(()=>{
  const rect=node=>{const {x,y,width,height}=node.getBoundingClientRect();return{x,y,width,height};};
  const scroll=node=>[node.scrollLeft,node.scrollTop];
  return{rows:[...document.querySelectorAll('#cron-dates tbody tr')].map(row=>({row:rect(row),copy:rect(row.lastElementChild.querySelector('button'))})),table:scroll(document.querySelector('.cron-dates-scroll')),main:scroll(document.querySelector('main')),page:[scrollX,scrollY],requests:window.cronRequests};
 });
}

for(const theme of ['light','dark'])for(const width of [390,1440]){
 test(`Cron UTC details keep rows, copy controls and scroll stable at ${width} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:800});const frame=await open(page,theme);
  if(theme==='dark')await expect(frame.locator('html')).toHaveClass(/dark/);else await expect(frame.locator('html')).not.toHaveClass(/dark/);
  await frame.locator('#cron-auto').uncheck();await frame.locator('#cron-preview-settings summary').click();
  await frame.locator('#cron-reference').fill('2026-01-01T00:00:00Z');await frame.locator('#cron-preview-settings summary').click();
  await frame.locator('#cron-run').click();await ready(frame);
  const panel=frame.getByRole('dialog',{name:'UTC time'});await expect(panel).toBeHidden();
  for(const index of [0,4,9]){
   const trigger=frame.locator('#cron-dates tbody tr').nth(index).getByRole('button',{name:/^UTC time/});
   await trigger.evaluate((node,last)=>{
    node.scrollIntoView({block:'center',inline:'nearest'});node.focus({preventScroll:true});
    if(last)document.querySelector('main').scrollTop+=node.getBoundingClientRect().bottom-innerHeight+18;
   },index===9);
   const before=await resultGeometry(frame);expect(before.requests).toBeGreaterThan(0);if(index===9)expect(before.table[1]).toBeGreaterThan(0);
   if(index===0)await trigger.click();else await page.keyboard.press(index===4?'Enter':'Space');
   await expect(panel).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','true');
   const utc='2026-01-01T00:'+String((index+1)*5).padStart(2,'0')+':00.000Z';
   await expect(panel.locator('time')).toHaveText(utc);await expect(panel.locator('time')).toHaveAttribute('datetime',utc);
   await expect(panel.locator('dd').nth(1)).toHaveText('Asia/Shanghai UTC+08:00');
   const placement=await trigger.evaluate(node=>{
    const box=node.getBoundingClientRect(),panel=document.getElementById(node.getAttribute('aria-controls')).getBoundingClientRect();
    return{within:panel.left>=0&&panel.right<=innerWidth&&panel.top>=0&&panel.bottom<=innerHeight,above:panel.bottom<=box.top,below:panel.top>=box.bottom};
   });
   expect(placement.within).toBe(true);if(index===9)expect(placement.above).toBe(true);else expect(placement.below).toBe(true);
   const opened=await resultGeometry(frame);await page.keyboard.press('Escape');await expect(panel).toBeHidden();
   await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false');const closed=await resultGeometry(frame);
   await testInfo.attach('cron-utc-row-'+(index+1),{body:JSON.stringify({before,opened,closed,placement}),contentType:'application/json'});
   expect(opened).toEqual(before);expect(closed).toEqual(before);
  }
 });
}

test('UTC popover tracks the visible row and dismisses when its anchor or focus leaves the tool',async({page})=>{
 const frame=await open(page);const row=frame.locator('#cron-dates tbody tr').nth(4),trigger=row.getByRole('button',{name:/^UTC time/}),panel=frame.getByRole('dialog',{name:'UTC time'});
 await trigger.evaluate(node=>node.scrollIntoView({block:'center'}));await trigger.click();await expect(panel).toBeVisible();
 const table=frame.locator('.cron-dates-scroll'),gap=()=>trigger.evaluate(node=>document.getElementById(node.getAttribute('aria-controls')).getBoundingClientRect().top-node.getBoundingClientRect().bottom);
 expect(await gap()).toBe(4);await table.evaluate(node=>{node.scrollTop+=24;});await expect.poll(gap).toBe(4);await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Close'}).click();await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
 await trigger.click();await trigger.click();await expect(panel).toBeHidden();await expect(trigger).toBeFocused();
 await trigger.click();await row.getByRole('button',{name:/^Copy ISO/}).click();await expect(panel).toBeHidden();await expect(trigger).toHaveAttribute('aria-expanded','false');
 await trigger.click();await page.locator('#settings-open').click();await expect(panel).toBeHidden();await expect(page.locator('#workbench-settings')).toBeVisible();
 await page.locator('#settings-close').click();const first=frame.locator('.cron-utc-trigger').first();await first.click();await expect(panel).toBeVisible();
 await table.evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(panel).toBeHidden();await expect(first).toHaveAttribute('aria-expanded','false');
});

for(const theme of ['light','dark'])for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844}]){
 test(`repeated Cron calculation keeps painted results and geometry at ${viewport.width}x${viewport.height} ${theme}`,async({page:host,browserName},testInfo)=>{
  await host.setViewportSize(viewport);const page=await open(host,theme);await page.locator('#cron-auto').uncheck();
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

test('Cron input changes invalidate old exports in both manual and auto modes',async({page:host,context,browserName})=>{
 await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);const page=await open(host);
 await page.locator('#cron-auto').uncheck();await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').fill('0 9 * * *');await page.locator('#cron-expression').press('Enter');await ready(page);
 await page.locator('#cron-expression').fill('0 10 * * *');await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').press('Enter');await ready(page);await expect(page.locator('#cron-description')).toHaveText('At 10:00');
 await page.locator('#cron-auto').check();await ready(page);await page.locator('#cron-expression').fill('0 11 * * *');await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await ready(page);await expect(page.locator('#cron-description')).toHaveText('At 11:00');
 await page.locator('#cron-copy-dates').click();expect((await page.evaluate(()=>navigator.clipboard.readText())).split('\n')).toHaveLength(10);
});

test('Cron pending presentation disables exports and clears on cancel, timeout and invalid input before retry',async({page:host})=>{
 const page=await open(host);await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.deliverCron)).toBe('function');
 await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await disabledExports(page);await expect(page.getByRole('button',{name:/^Copy ISO/}).first()).toBeDisabled();
 await expect(page.locator('[aria-labelledby="cron-result-title"]')).toHaveAttribute('aria-busy','true');
 await page.locator('#cron-cancel').click();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await disabledExports(page);
 await page.evaluate(()=>{window.deliverCron();window.holdCron=false;});await page.waitForTimeout(100);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-run').click();await ready(page);
 await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible({timeout:4000});await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);await disabledExports(page);
 await page.evaluate(()=>{window.holdCron=false;});await page.locator('#cron-run').click();await ready(page);
 await page.locator('#cron-auto').uncheck();await page.locator('#cron-expression').fill('61 * * * *');await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible();await disabledExports(page);await expect(page.locator('#cron-dates tbody tr')).toHaveCount(0);
 await page.locator('#cron-expression').fill('*/5 * * * *');await page.locator('#cron-expression').press('Enter');await ready(page);await expect(page.locator('#cron-error')).toBeHidden();
});

test('Cron retained presentation changes language during pending work without restarting it',async({page:host})=>{
 const page=await open(host);await page.evaluate(()=>{window.holdCron=true;});await page.locator('#cron-run').click();await expect.poll(()=>page.evaluate(()=>typeof window.deliverCron)).toBe('function');const requests=await page.evaluate(()=>window.cronRequests);
 await selectLanguage(host,'ru');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await expect(page.locator('#cron-description')).not.toContainText('Every');await disabledExports(page);
 expect(await page.evaluate(()=>window.cronRequests)).toBe(requests);await page.evaluate(()=>window.deliverCron());await ready(page);await expect(page.locator('#cron-status')).toHaveText('Найдено запусков: 10');
});
