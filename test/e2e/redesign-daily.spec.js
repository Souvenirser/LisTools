import {test,expect} from '@playwright/test';
import {activeTool,chooseTask,countdownDuration} from './task-helpers.js';

test.beforeEach(async({page,context,browserName})=>{
  if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
});

test('calculator keeps precision guidance and identifies business operands and result source',async({page})=>{
  await page.setViewportSize({width:1366,height:768});await page.goto('/calculator.html');
  const precision=activeTool(page).locator('details').filter({has:activeTool(page).locator('#calculator-precision')});await precision.locator('summary').click();await expect(activeTool(page).locator('#calculator-precision')).toBeVisible();await precision.locator('summary').click();
  await activeTool(page).locator('#expression').fill('2+3');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#result')).toHaveText('5');
  await expect(activeTool(page).locator('#result-source')).toContainText('2+3');
  await activeTool(page).locator('#business-details summary').click();
  const modes=[['growth','Original value','New value'],['discount','Original price','Percentage off (%)'],['share','Part','Whole'],['part','Whole','Percentage (%)'],['whole','Part','Percentage (%)']];
  for(const [mode,first,second] of modes){await activeTool(page).locator('#mode').selectOption(mode);await expect(activeTool(page).locator('label[for="first"]')).toHaveText(first);await expect(activeTool(page).locator('label[for="second"]')).toHaveText(second);}
  await activeTool(page).locator('#mode').selectOption('growth');await activeTool(page).locator('#first').fill('100');await activeTool(page).locator('#second').fill('120');await activeTool(page).locator('#business-run').click();
  await expect(activeTool(page).locator('#result')).toHaveText('20');await expect(activeTool(page).locator('#result-source')).toContainText('Growth rate');await expect(activeTool(page).locator('#expression')).toHaveValue('2+3');
  await activeTool(page).locator('#copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('20');
  await activeTool(page).locator('#calc-mode-scientific').click();await activeTool(page).locator('#expression').fill('Ans*2');await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#result')).toHaveText('40');
  await expect(activeTool(page).locator('#result-source')).toContainText('Ans*2');await expect(activeTool(page).locator('#history li')).toHaveCount(3);
});

test('date task changes restore only that task status and preserve valid results',async({page})=>{
  await page.goto('/dates.html');await activeTool(page).locator('#date-start').fill('2026-10-01');await activeTool(page).locator('#date-end').fill('2026-10-08');await activeTool(page).locator('#difference-run').click();
  await chooseTask(page,'dates','milestone');await activeTool(page).locator('#milestone-run').click();await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);
  await chooseTask(page,'dates','difference');await expect(activeTool(page).locator('#tool-status')).toBeHidden();await expect(activeTool(page).locator('#difference-output')).toContainText('7');await expect(activeTool(page).locator('#difference-copy')).toBeEnabled();
  await chooseTask(page,'dates','milestone');await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);
  await activeTool(page).locator('#date-origin').fill('2000-01-01');await activeTool(page).locator('#milestone-run').click();await expect(activeTool(page).locator('#tool-status')).toBeHidden();
  await activeTool(page).locator('#date-origin').fill('2001-01-01');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
  await chooseTask(page,'dates','difference');await expect(activeTool(page).locator('#tool-status')).toBeHidden();await chooseTask(page,'dates','milestone');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
});

test('workday result explains range end rule and distinct exception date counts',async({page})=>{
  await page.goto('/dates.html');await chooseTask(page,'dates','workdays');await activeTool(page).locator('#work-start').fill('2026-10-01');await activeTool(page).locator('#work-end').fill('2026-10-08');
  await activeTool(page).locator('details').filter({has:activeTool(page).locator('#date-off')}).locator('summary').click();await activeTool(page).locator('#date-off').fill('2026-10-02, 2026-10-02');await activeTool(page).locator('#date-work').fill('2026-10-03');await activeTool(page).locator('#workdays-run').click();
  const result=activeTool(page).locator('#workdays-output');await expect(result).toContainText('5');await expect(result).toContainText('2026-10-01');await expect(result).toContainText('2026-10-08');await expect(result).toContainText('End date excluded');await expect(result).toContainText('Days off: 1');await expect(result).toContainText('Working dates: 1');
  await activeTool(page).locator('#work-inclusive').check();await activeTool(page).locator('#workdays-run').click();await expect(result).toContainText('6');await expect(result).toContainText('Include the end date');
  await activeTool(page).locator('#workdays-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('2026-10-02');expect(copied).toContain('2026-10-03');
});

test('unit equation copy says it copies the display while exact numeric copy remains intact',async({page})=>{
  await page.goto('/units.html');await activeTool(page).locator('#unit-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('0.001');
  await expect(activeTool(page).locator('#unit-copy-equation')).toHaveAccessibleName('Copy displayed equation');await activeTool(page).locator('#unit-copy-equation').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('1 meters (m) = 0.001 kilometers (km)');
});

test('money format copy buttons have distinct names and copy their corresponding format',async({page})=>{
  await page.goto('/money.html');await activeTool(page).locator('#money-input').fill('1000');await activeTool(page).locator('#money-run').click();await activeTool(page).locator('#money-other-formats summary').click();
  const expected={rounded:'1000.00',grouped:'1,000.00',simplified:'壹仟元整',traditional:'壹仟圓整'},names=[];for(const key of ['rounded','grouped','simplified','traditional']){const button=activeTool(page).locator('#copy-'+key),name=await button.getAttribute('aria-label');expect(name).toBeTruthy();names.push(name);await button.click();await expect(activeTool(page).locator('#money-'+key)).toHaveText(expected[key]);expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(expected[key]);}
  expect(new Set(names).size).toBe(4);
});

test('draw preserves each task result and error while only edited task becomes stale',async({page})=>{
  await page.goto('/draw.html');await activeTool(page).locator('#draw-input').fill('Alice\nBob\nCharlie');await activeTool(page).locator('#draw-mode').selectOption('shuffle');await expect(activeTool(page).locator('#draw-run')).toHaveAccessibleName('Shuffle list');await activeTool(page).locator('#draw-run').click();
  await activeTool(page).locator('#draw-copy').click();const list=await page.evaluate(()=>navigator.clipboard.readText());expect(list.split('\n').sort()).toEqual(['Alice','Bob','Charlie']);
  await chooseTask(page,'draw','numbers');await activeTool(page).locator('#draw-min').fill('7');await activeTool(page).locator('#draw-max').fill('7');await activeTool(page).locator('#draw-number-run').click();await expect(activeTool(page).locator('#draw-result')).toHaveText('7');
  await chooseTask(page,'draw','list');await activeTool(page).locator('#draw-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(list);
  await activeTool(page).locator('#draw-input').fill('Alice\nBob\nCharlie\nDave');await expect(activeTool(page).locator('#draw-copy')).toBeDisabled();await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
  await chooseTask(page,'draw','numbers');await expect(activeTool(page).locator('#draw-result')).toHaveText('7');await expect(activeTool(page).locator('#tool-status')).toBeHidden();await expect(activeTool(page).locator('#draw-copy')).toBeEnabled();
  await activeTool(page).locator('#draw-min').fill('8');await activeTool(page).locator('#draw-number-run').click();await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);await chooseTask(page,'draw','list');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');await chooseTask(page,'draw','numbers');await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);
});

test('draw action follows sample and grouping operations',async({page})=>{
  await page.goto('/draw.html');await expect(activeTool(page).locator('#draw-run')).toHaveAccessibleName('Draw entries · 1');
  await activeTool(page).locator('#draw-mode').selectOption('groups');await expect(activeTool(page).locator('#draw-run')).toHaveAccessibleName('Create groups · 1');await activeTool(page).locator('#draw-input').fill('Alice\nBob');await activeTool(page).locator('#draw-count').fill('2');await activeTool(page).locator('#draw-run').click();await expect(activeTool(page).locator('#draw-result .draw-group')).toHaveCount(2);
  await activeTool(page).locator('#draw-mode').selectOption('members');await expect(activeTool(page).locator('#draw-run')).toHaveAccessibleName('Group entries · 2 per group');
});

test('timer shows another running mode and recovers the same tab session after reload',async({page})=>{
  await page.goto('/timer.html');await countdownDuration(activeTool(page),60);await activeTool(page).locator('#timer-start').click();await chooseTask(page,'timer','stopwatch');
  await expect(activeTool(page).locator('#timer-other-running')).toBeVisible();await expect(activeTool(page).locator('#timer-other-running')).toContainText('Countdown');await expect(activeTool(page).locator('#timer-session-help')).toContainText('Reloading this tab');
  await activeTool(page).locator('#timer-start').click();await page.reload();await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await expect(activeTool(page).locator('#timer-other-running')).toContainText('Countdown');await activeTool(page).locator('#timer-pause').click();
  await chooseTask(page,'timer','countdown');await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await expect(activeTool(page).locator('#timer-other-running')).toBeHidden();await activeTool(page).locator('#timer-pause').click();
});
