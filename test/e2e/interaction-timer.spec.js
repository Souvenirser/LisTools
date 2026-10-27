import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';

const layouts=[{name:'desktop',width:1366,height:768},{name:'tall desktop',width:1440,height:900},{name:'phone',width:390,height:844}];
const selectors=['#timer-settings>summary','#timer-progress','#timer-start','#timer-pause','#timer-reset'];
async function positions(page){return page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{const element=document.querySelector(selector),box=element.getBoundingClientRect(),card=element.closest('.tool-card').getBoundingClientRect();return [selector,{x:box.x-card.x,y:element.closest('.workspace-action-fixed')?box.y:box.y-card.y,width:box.width,height:box.height}];})),selectors);}
function expectStable(actual,baseline,label){for(const selector of selectors)for(const axis of ['x','y','width','height'])expect(Math.abs(actual[selector][axis]-baseline[selector][axis]),`${label}: ${selector} ${axis}`).toBeLessThanOrEqual(1);}

for(const theme of ['light','dark'])for(const layout of layouts)test(`timer controls and open duration settings stay in place through ticks and repeated pause/resume — ${theme} ${layout.name}`,async({page})=>{
  await page.setViewportSize({width:layout.width,height:layout.height});
  await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);
  await page.goto('/timer.html');await expect(page.locator('#timer-start')).toBeEnabled();
  await expect(page.locator('#timer-display')).toBeInViewport({ratio:1});await expect(page.locator('#timer-start')).toBeInViewport({ratio:1});
  const baseline=await positions(page),fields=page.locator('.timer-duration-inputs input');
  await page.evaluate(selectors=>{window.timerLayoutTicks=[];new MutationObserver(()=>window.timerLayoutTicks.push(Object.fromEntries(selectors.map(selector=>{const element=document.querySelector(selector),box=element.getBoundingClientRect(),card=element.closest('.tool-card').getBoundingClientRect();return [selector,{x:box.x-card.x,y:element.closest('.workspace-action-fixed')?box.y:box.y-card.y,width:box.width,height:box.height}];})))).observe(document.querySelector('#timer-display'),{childList:true});},selectors);
  for(let attempt=0;attempt<3;attempt++){
    await page.locator('#timer-start').click();await expect(page.locator('#timer-pause')).toBeEnabled();
    await expect(page.locator('#timer-settings')).toHaveAttribute('open','');
    await expect(fields.nth(0)).toBeDisabled();await expect(fields.nth(1)).toBeDisabled();await expect(fields.nth(2)).toBeDisabled();
    await page.waitForTimeout(350);expectStable(await positions(page),baseline,`running ${attempt}`);
    await page.locator('#timer-pause').click();await expect(page.locator('#timer-state')).toHaveText('Paused');await expect(fields.nth(1)).toBeEnabled();
    expectStable(await positions(page),baseline,`paused ${attempt}`);
    await expect(fields.nth(0)).toHaveValue('0');await expect(fields.nth(1)).toHaveValue('5');await expect(fields.nth(2)).toHaveValue('0');
  }
  const ticks=await page.evaluate(()=>window.timerLayoutTicks);expect(ticks.length).toBeGreaterThanOrEqual(6);for(const tick of ticks)expectStable(tick,baseline,'rendered tick');
  await page.locator('#timer-reset').click();expectStable(await positions(page),baseline,'reset');
  await page.locator('#timer-seconds').fill('61');await page.locator('#timer-seconds').press('Tab');await expect(page.locator('#timer-seconds')).toHaveAttribute('aria-invalid','true');expectStable(await positions(page),baseline,'invalid duration');
  await page.locator('#timer-seconds').fill('0');await page.locator('#timer-seconds').press('Tab');await expect(page.locator('#timer-seconds')).not.toHaveAttribute('aria-invalid','true');expectStable(await positions(page),baseline,'valid duration');
  await page.locator('#timer-settings>summary').click();await expect(page.locator('#timer-settings')).not.toHaveAttribute('open','');const closed=await positions(page);
  await page.locator('#timer-start').click();await page.locator('#timer-pause').click();await expect(page.locator('#timer-settings')).not.toHaveAttribute('open','');expectStable(await positions(page),closed,'user-closed settings');
});

test('timer keeps independent running modes, paused edits, laps, sound, and refresh restoration',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
  await page.goto('/timer.html');await page.locator('#timer-sound').check();await page.locator('#timer-start').click();
  await chooseTask(page,'timer','stopwatch');await expect(page.locator('#timer-other-running')).toContainText('Countdown');const otherRunningTop=(await positions(page))['#timer-progress'].y;await page.locator('#timer-start').click();await page.waitForTimeout(180);await page.locator('#timer-lap').click();await expect(page.locator('#timer-laps tr')).toHaveCount(1);
  await page.reload();await expect(page.locator('#timer-other-running')).toContainText('Countdown');await expect(page.locator('#timer-pause')).toBeEnabled();await expect(page.locator('#timer-laps tr')).toHaveCount(1);await page.locator('#timer-pause').click();
  await chooseTask(page,'timer','countdown');await expect(page.locator('#timer-pause')).toBeEnabled();await page.locator('#timer-pause').click();await chooseTask(page,'timer','stopwatch');await expect(page.locator('#timer-other-running')).toBeHidden();expect(Math.abs((await positions(page))['#timer-progress'].y-otherRunningTop)).toBeLessThanOrEqual(1);await chooseTask(page,'timer','countdown');await page.locator('#timer-minutes').fill('2');await page.locator('#timer-minutes').press('Tab');await expect(page.locator('#timer-display')).toHaveText('00:02:00.000');
  await page.reload();await expect(page.locator('#timer-minutes')).toHaveValue('2');await expect(page.locator('#timer-display')).toHaveText('00:02:00.000');await page.locator('#timer-start').click();await page.locator('#timer-pause').click();
  await page.locator('#timer-minutes').fill('0');await page.locator('#timer-seconds').fill('1');await page.locator('#timer-seconds').press('Tab');const beforeFinish=await positions(page);await page.locator('#timer-start').click();await expect(page.locator('#timer-state')).toHaveText('Countdown complete.');await expect(page.locator('#timer-start')).toBeEnabled();expectStable(await positions(page),beforeFinish,'finished');
});
