import {test,expect} from '@playwright/test';
import {activeTool,evaluateTool,chooseTask} from './task-helpers.js';

const layouts=[{name:'desktop',width:1366,height:768},{name:'tall desktop',width:1440,height:900},{name:'phone',width:390,height:844}];
const selectors=['#timer-settings>summary','#timer-progress','#timer-start','#timer-pause','#timer-reset'];
async function positions(page){return evaluateTool(page,selectors=>Object.fromEntries(selectors.map(selector=>{const element=document.querySelector(selector),box=element.getBoundingClientRect(),card=element.closest('.tool-card').getBoundingClientRect();return [selector,{x:box.x-card.x,y:element.closest('.workspace-action-fixed')?box.y:box.y-card.y,width:box.width,height:box.height}];})),selectors);}
function expectStable(actual,baseline,label){for(const selector of selectors)for(const axis of ['x','y','width','height'])expect(Math.abs(actual[selector][axis]-baseline[selector][axis]),`${label}: ${selector} ${axis}`).toBeLessThanOrEqual(1);}

for(const theme of ['light','dark'])for(const layout of layouts)test(`timer controls and open duration settings stay in place through ticks and repeated pause/resume — ${theme} ${layout.name}`,async({page})=>{
  await page.setViewportSize({width:layout.width,height:layout.height});
  await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);
  await page.goto('/timer.html');await expect(activeTool(page).locator('#timer-start')).toBeEnabled();
  await expect(activeTool(page).locator('#timer-display')).toBeInViewport({ratio:1});await expect(activeTool(page).locator('#timer-start')).toBeInViewport({ratio:1});
  const baseline=await positions(page),fields=activeTool(page).locator('.timer-duration-inputs input');
  await evaluateTool(page,selectors=>{window.timerLayoutTicks=[];new MutationObserver(()=>window.timerLayoutTicks.push(Object.fromEntries(selectors.map(selector=>{const element=document.querySelector(selector),box=element.getBoundingClientRect(),card=element.closest('.tool-card').getBoundingClientRect();return [selector,{x:box.x-card.x,y:element.closest('.workspace-action-fixed')?box.y:box.y-card.y,width:box.width,height:box.height}];})))).observe(document.querySelector('#timer-display'),{childList:true});},selectors);
  for(let attempt=0;attempt<3;attempt++){
    await activeTool(page).locator('#timer-start').click();await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();
    await expect(activeTool(page).locator('#timer-settings')).toHaveAttribute('open','');
    await expect(fields.nth(0)).toBeDisabled();await expect(fields.nth(1)).toBeDisabled();await expect(fields.nth(2)).toBeDisabled();
    await page.waitForTimeout(350);expectStable(await positions(page),baseline,`running ${attempt}`);
    await activeTool(page).locator('#timer-pause').click();await expect(activeTool(page).locator('#timer-state')).toHaveText('Paused');await expect(fields.nth(1)).toBeEnabled();
    expectStable(await positions(page),baseline,`paused ${attempt}`);
    await expect(fields.nth(0)).toHaveValue('0');await expect(fields.nth(1)).toHaveValue('5');await expect(fields.nth(2)).toHaveValue('0');
  }
  const ticks=await evaluateTool(page,()=>window.timerLayoutTicks);expect(ticks.length).toBeGreaterThanOrEqual(6);for(const tick of ticks)expectStable(tick,baseline,'rendered tick');
  await activeTool(page).locator('#timer-reset').click();expectStable(await positions(page),baseline,'reset');
  await activeTool(page).locator('#timer-seconds').fill('61');await activeTool(page).locator('#timer-seconds').press('Tab');await expect(activeTool(page).locator('#timer-seconds')).toHaveAttribute('aria-invalid','true');expectStable(await positions(page),baseline,'invalid duration');
  await activeTool(page).locator('#timer-seconds').fill('0');await activeTool(page).locator('#timer-seconds').press('Tab');await expect(activeTool(page).locator('#timer-seconds')).not.toHaveAttribute('aria-invalid','true');expectStable(await positions(page),baseline,'valid duration');
  await activeTool(page).locator('#timer-settings>summary').click();await expect(activeTool(page).locator('#timer-settings')).not.toHaveAttribute('open','');const closed=await positions(page);
  await activeTool(page).locator('#timer-start').click();await activeTool(page).locator('#timer-pause').click();await expect(activeTool(page).locator('#timer-settings')).not.toHaveAttribute('open','');expectStable(await positions(page),closed,'user-closed settings');
});

test('timer keeps independent running modes, paused edits, laps, sound, and refresh restoration',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
  await page.goto('/timer.html');await activeTool(page).locator('#timer-sound').check();await activeTool(page).locator('#timer-start').click();
  await chooseTask(page,'timer','stopwatch');await expect(activeTool(page).locator('#timer-other-running')).toContainText('Countdown');const otherRunningTop=(await positions(page))['#timer-progress'].y;await activeTool(page).locator('#timer-start').click();await page.waitForTimeout(180);await activeTool(page).locator('#timer-lap').click();await expect(activeTool(page).locator('#timer-laps tr')).toHaveCount(1);
  await page.reload();await expect(activeTool(page).locator('#timer-other-running')).toContainText('Countdown');await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await expect(activeTool(page).locator('#timer-laps tr')).toHaveCount(1);await activeTool(page).locator('#timer-pause').click();
  await chooseTask(page,'timer','countdown');await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await activeTool(page).locator('#timer-pause').click();await chooseTask(page,'timer','stopwatch');await expect(activeTool(page).locator('#timer-other-running')).toBeHidden();expect(Math.abs((await positions(page))['#timer-progress'].y-otherRunningTop)).toBeLessThanOrEqual(1);await chooseTask(page,'timer','countdown');await activeTool(page).locator('#timer-minutes').fill('2');await activeTool(page).locator('#timer-minutes').press('Tab');await expect(activeTool(page).locator('#timer-display')).toHaveText('00:02:00.000');
  await page.reload();await expect(activeTool(page).locator('#timer-minutes')).toHaveValue('2');await expect(activeTool(page).locator('#timer-display')).toHaveText('00:02:00.000');await activeTool(page).locator('#timer-start').click();await activeTool(page).locator('#timer-pause').click();
  await activeTool(page).locator('#timer-minutes').fill('0');await activeTool(page).locator('#timer-seconds').fill('1');await activeTool(page).locator('#timer-seconds').press('Tab');const beforeFinish=await positions(page);await activeTool(page).locator('#timer-start').click();await expect(activeTool(page).locator('#timer-state')).toHaveText('Countdown complete.');await expect(activeTool(page).locator('#timer-start')).toBeEnabled();expectStable(await positions(page),beforeFinish,'finished');
});
