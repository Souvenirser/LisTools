import {test,expect} from '@playwright/test';
import {chooseTask,countdownDuration} from './task-helpers.js';

test.beforeEach(async({page,context,browserName})=>{
  if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
});

test('calculator keeps precision guidance and identifies business operands and result source',async({page})=>{
  await page.setViewportSize({width:1366,height:768});await page.goto('/calculator.html');
  const precision=page.locator('details').filter({has:page.locator('#calculator-precision')});await precision.locator('summary').click();await expect(page.locator('#calculator-precision')).toBeVisible();await precision.locator('summary').click();
  await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');
  await expect(page.locator('#result-source')).toContainText('2+3');
  await page.locator('#business-details summary').click();
  const modes=[['growth','Original value','New value'],['discount','Original price','Percentage off (%)'],['share','Part','Whole'],['part','Whole','Percentage (%)'],['whole','Part','Percentage (%)']];
  for(const [mode,first,second] of modes){await page.locator('#mode').selectOption(mode);await expect(page.locator('label[for="first"]')).toHaveText(first);await expect(page.locator('label[for="second"]')).toHaveText(second);}
  await page.locator('#mode').selectOption('growth');await page.locator('#first').fill('100');await page.locator('#second').fill('120');await page.locator('#business-run').click();
  await expect(page.locator('#result')).toHaveText('20');await expect(page.locator('#result-source')).toContainText('Growth rate');await expect(page.locator('#expression')).toHaveValue('2+3');
  await page.locator('#copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('20');
  await page.locator('#calc-mode-scientific').click();await page.locator('#expression').fill('Ans*2');await page.locator('#expression').press('Enter');await expect(page.locator('#result')).toHaveText('40');
  await expect(page.locator('#result-source')).toContainText('Ans*2');await expect(page.locator('#history li')).toHaveCount(3);
});

test('date task changes restore only that task status and preserve valid results',async({page})=>{
  await page.goto('/dates.html');await page.locator('#date-start').fill('2026-10-01');await page.locator('#date-end').fill('2026-10-08');await page.locator('#difference-run').click();
  await chooseTask(page,'dates','milestone');await page.locator('#milestone-run').click();await expect(page.locator('#tool-status')).toHaveClass(/is-error/);
  await chooseTask(page,'dates','difference');await expect(page.locator('#tool-status')).toBeHidden();await expect(page.locator('#difference-output')).toContainText('7');await expect(page.locator('#difference-copy')).toBeEnabled();
  await chooseTask(page,'dates','milestone');await expect(page.locator('#tool-status')).toHaveClass(/is-error/);
  await page.locator('#date-origin').fill('2000-01-01');await page.locator('#milestone-run').click();await expect(page.locator('#tool-status')).toBeHidden();
  await page.locator('#date-origin').fill('2001-01-01');await expect(page.locator('#tool-status')).toContainText('Content changed');
  await chooseTask(page,'dates','difference');await expect(page.locator('#tool-status')).toBeHidden();await chooseTask(page,'dates','milestone');await expect(page.locator('#tool-status')).toContainText('Content changed');
});

test('workday result explains range end rule and distinct exception date counts',async({page})=>{
  await page.goto('/dates.html');await chooseTask(page,'dates','workdays');await page.locator('#work-start').fill('2026-10-01');await page.locator('#work-end').fill('2026-10-08');
  await page.locator('details').filter({has:page.locator('#date-off')}).locator('summary').click();await page.locator('#date-off').fill('2026-10-02, 2026-10-02');await page.locator('#date-work').fill('2026-10-03');await page.locator('#workdays-run').click();
  const result=page.locator('#workdays-output');await expect(result).toContainText('5');await expect(result).toContainText('2026-10-01');await expect(result).toContainText('2026-10-08');await expect(result).toContainText('End date excluded');await expect(result).toContainText('Days off: 1');await expect(result).toContainText('Working dates: 1');
  await page.locator('#work-inclusive').check();await page.locator('#workdays-run').click();await expect(result).toContainText('6');await expect(result).toContainText('Include the end date');
  await page.locator('#workdays-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('2026-10-02');expect(copied).toContain('2026-10-03');
});

test('unit equation copy says it copies the display while exact numeric copy remains intact',async({page})=>{
  await page.goto('/units.html');await page.locator('#unit-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('0.001');
  await expect(page.locator('#unit-copy-equation')).toHaveAccessibleName('Copy displayed equation');await page.locator('#unit-copy-equation').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('1 meters (m) = 0.001 kilometers (km)');
});

test('money format copy buttons have distinct names and copy their corresponding format',async({page})=>{
  await page.goto('/money.html');await page.locator('#money-input').fill('1000');await page.locator('#money-run').click();await page.locator('#money-other-formats summary').click();
  const expected={rounded:'1000.00',grouped:'1,000.00',simplified:'壹仟元整',traditional:'壹仟圓整'},names=[];for(const key of ['rounded','grouped','simplified','traditional']){const button=page.locator('#copy-'+key),name=await button.getAttribute('aria-label');expect(name).toBeTruthy();names.push(name);await button.click();await expect(page.locator('#money-'+key)).toHaveText(expected[key]);expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(expected[key]);}
  expect(new Set(names).size).toBe(4);
});

test('draw preserves each task result and error while only edited task becomes stale',async({page})=>{
  await page.goto('/draw.html');await page.locator('#draw-input').fill('Alice\nBob\nCharlie');await page.locator('#draw-mode').selectOption('shuffle');await expect(page.locator('#draw-run')).toHaveAccessibleName('Shuffle list');await page.locator('#draw-run').click();
  await page.locator('#draw-copy').click();const list=await page.evaluate(()=>navigator.clipboard.readText());expect(list.split('\n').sort()).toEqual(['Alice','Bob','Charlie']);
  await chooseTask(page,'draw','numbers');await page.locator('#draw-min').fill('7');await page.locator('#draw-max').fill('7');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-result')).toHaveText('7');
  await chooseTask(page,'draw','list');await page.locator('#draw-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(list);
  await page.locator('#draw-input').fill('Alice\nBob\nCharlie\nDave');await expect(page.locator('#draw-copy')).toBeDisabled();await expect(page.locator('#tool-status')).toContainText('Content changed');
  await chooseTask(page,'draw','numbers');await expect(page.locator('#draw-result')).toHaveText('7');await expect(page.locator('#tool-status')).toBeHidden();await expect(page.locator('#draw-copy')).toBeEnabled();
  await page.locator('#draw-min').fill('8');await page.locator('#draw-number-run').click();await expect(page.locator('#tool-status')).toHaveClass(/is-error/);await chooseTask(page,'draw','list');await expect(page.locator('#tool-status')).toContainText('Content changed');await chooseTask(page,'draw','numbers');await expect(page.locator('#tool-status')).toHaveClass(/is-error/);
});

test('draw action follows sample and grouping operations',async({page})=>{
  await page.goto('/draw.html');await expect(page.locator('#draw-run')).toHaveAccessibleName('Draw entries · 1');
  await page.locator('#draw-mode').selectOption('groups');await expect(page.locator('#draw-run')).toHaveAccessibleName('Create groups · 1');await page.locator('#draw-input').fill('Alice\nBob');await page.locator('#draw-count').fill('2');await page.locator('#draw-run').click();await expect(page.locator('#draw-result .draw-group')).toHaveCount(2);
  await page.locator('#draw-mode').selectOption('members');await expect(page.locator('#draw-run')).toHaveAccessibleName('Group entries · 2 per group');
});

test('timer shows another running mode and recovers the same tab session after reload',async({page})=>{
  await page.goto('/timer.html');await countdownDuration(page,60);await page.locator('#timer-start').click();await chooseTask(page,'timer','stopwatch');
  await expect(page.locator('#timer-other-running')).toBeVisible();await expect(page.locator('#timer-other-running')).toContainText('Countdown');await expect(page.locator('#timer-session-help')).toContainText('Reloading this tab');
  await page.locator('#timer-start').click();await page.reload();await expect(page.locator('#timer-pause')).toBeEnabled();await expect(page.locator('#timer-other-running')).toContainText('Countdown');await page.locator('#timer-pause').click();
  await chooseTask(page,'timer','countdown');await expect(page.locator('#timer-pause')).toBeEnabled();await expect(page.locator('#timer-other-running')).toBeHidden();await page.locator('#timer-pause').click();
});
