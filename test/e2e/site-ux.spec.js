import {activeTool} from './task-helpers.js';
import {chooseConversionTool} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('shared reading scale, task widths and calculator proportions',async({page})=>{
  await page.setViewportSize({width:2560,height:1440});
  for(const [file,max] of [['qr',1600],['dates',1120],['calculator',1244],['timer',960],['money',1120]]){
    await page.goto(`/${file}.html`);
    expect(await page.locator('main').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),file).toBe(16);
    const root=activeTool(page).locator('#tool-root');
    expect((await root.boundingBox()).width,file).toBeLessThanOrEqual(max+1);
    expect(await activeTool(page).locator('h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),file).toBe(28);
  }
  await page.goto('/calculator.html');
  expect((await activeTool(page).locator('.calculator-workbench').boundingBox()).width).toBeLessThanOrEqual(480);
});

test('date tasks preserve independent input and results through task and language changes',async({page})=>{
  await page.goto('/dates.html');
  await activeTool(page).locator('#date-start').fill('2024-02-28');await activeTool(page).locator('#date-end').fill('2024-03-01');
  await activeTool(page).locator('#difference-run').click();await expect(activeTool(page).locator('#difference-output')).toContainText('2');
  await activeTool(page).locator('#dates-task-shift').click();await expect(activeTool(page).locator('#date-start')).toBeHidden();
  await activeTool(page).locator('#date-base').fill('2024-01-31');await activeTool(page).locator('#date-unit').selectOption('months');await activeTool(page).locator('#date-amount').fill('1');
  await activeTool(page).locator('#shift-run').click();await expect(activeTool(page).locator('#shift-output')).toContainText('2024-02-29');
  await page.setViewportSize({width:390,height:844});
  await activeTool(page).locator('#dates-task-select').selectOption('difference');await selectLanguage(page,'de');
  await expect(activeTool(page).locator('#date-start')).toHaveValue('2024-02-28');await expect(activeTool(page).locator('#difference-output')).toContainText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('money begins blank and converts only on explicit action',async({page})=>{
  await page.goto('/money.html');await expect(activeTool(page).locator('#money-input')).toHaveValue('');await expect(activeTool(page).locator('#money-simplified')).toBeEmpty();
  await activeTool(page).locator('#money-input').fill('12.34');await expect(activeTool(page).locator('#money-simplified')).toBeEmpty();
  await activeTool(page).locator('#money-input').press('Enter');await expect(activeTool(page).locator('#money-simplified')).not.toBeEmpty();
});

test('compact tool selection frees the entire conversion workspace',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/convert.html#base64');
 await expect(activeTool(page).locator('#convert-catalog-toggle')).toBeVisible();await expect(activeTool(page).locator('.convert-catalog')).toBeHidden();
 await activeTool(page).locator('#convert-catalog-toggle').click();await activeTool(page).locator('#convert-search').fill('JSON');await expect(activeTool(page).locator('#convert-tool-list a').first()).toBeVisible();
 await chooseConversionTool(page,'#convert-tool-list a[href="#json-yaml"]');await expect(activeTool(page).locator('.convert-catalog')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('MD5 primary action is before editors and secondary formats are collapsed',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/convert.html#md5');
 const run=await activeTool(page).locator('#md5-run').boundingBox();expect(run.y+run.height).toBeLessThan(700);
 await expect(activeTool(page).locator('#md5-other-formats')).not.toHaveAttribute('open','');
 await expect(activeTool(page).locator('#md5-value-hex32lower')).toBeVisible();await expect(activeTool(page).locator('#md5-value-base64')).toBeHidden();
});

test('all six text tasks expose their own options',async({page})=>{
 await page.goto('/text.html');await activeTool(page).locator('#text-input').fill('hello world');
 await activeTool(page).locator('#text-task-case').click();await expect(activeTool(page).locator('#text-case')).toBeVisible();await expect(activeTool(page).locator('#text-kind')).toBeHidden();
 await expect(activeTool(page).locator('#text-input')).toHaveValue('hello world');await activeTool(page).locator('#text-task-newline').click();await expect(activeTool(page).locator('#text-newline')).toBeVisible();
});

test('duration inputs adapt seconds and prevent changes while running',async({page})=>{
 await page.goto('/timer.html');await activeTool(page).locator('#timer-minutes').fill('1');await activeTool(page).locator('#timer-seconds').fill('2');await activeTool(page).locator('#timer-seconds').blur();
 await expect(activeTool(page).locator('#timer-duration')).toHaveValue('62');await activeTool(page).locator('#timer-start').click();await expect(activeTool(page).locator('#timer-minutes')).toBeDisabled();
 await activeTool(page).locator('#timer-pause').click();await expect(activeTool(page).locator('#timer-minutes')).toBeEnabled();await activeTool(page).locator('#timer-seconds').fill('5');await activeTool(page).locator('#timer-seconds').blur();await expect(activeTool(page).locator('#timer-duration')).toHaveValue('65');
 await page.reload();await expect(activeTool(page).locator('#timer-duration')).toHaveValue('65');
 await activeTool(page).locator('#timer-task-stopwatch').click();await expect(activeTool(page).locator('#timer-duration-field')).toBeHidden();await expect(activeTool(page).locator('#timer-lap')).toBeVisible();
});

test('list and integer draws expose one task at a time without losing the list',async({page})=>{
 await page.goto('/draw.html');await activeTool(page).locator('#draw-input').fill('Alice\nBob\nAlice');
 await activeTool(page).locator('#draw-task-numbers').click();await expect(activeTool(page).locator('#draw-input')).toBeHidden();await activeTool(page).locator('#draw-number-run').click();await expect(activeTool(page).locator('#draw-result')).not.toBeEmpty();
 await activeTool(page).locator('#draw-task-list').click();await expect(activeTool(page).locator('#draw-input')).toHaveValue('Alice\nBob\nAlice');await expect(activeTool(page).locator('#draw-number-run')).toBeHidden();
});

test('language changes preserve the selected regex match and editor selection',async({page})=>{
 await page.goto('/regex.html');await activeTool(page).locator('#regex-pattern').fill('ORDER-\\d+');await activeTool(page).locator('#regex-source .cm-content').fill('ORDER-1 ORDER-2');await activeTool(page).locator('#regex-run').click();await expect(activeTool(page).locator('#regex-match-rows tr')).toHaveCount(2);await activeTool(page).locator('#regex-next').click();
 await expect(activeTool(page).locator('#regex-match-rows button[aria-current]')).toHaveText('2');
 const selection=await activeTool(page).locator('#regex-source').evaluate(node=>{const range=getSelection();return range?.toString();});
 await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#regex-match-rows button[aria-current]')).toHaveText('2');
 await activeTool(page).locator('#regex-source .cm-content').focus();expect(await activeTool(page).locator('#regex-source').evaluate(()=>getSelection()?.toString())).toBe(selection);
});

test('timestamp result fields show complete values on narrow screens',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/timestamp.html');await activeTool(page).locator('#timestamp-source').fill('1704067200123');
 await expect(activeTool(page).locator('#timestamp-iso')).not.toHaveValue('');await activeTool(page).locator('#timestamp-more-formats summary').click();await expect(activeTool(page).locator('#timestamp-iso')).toBeVisible();
 await expect.poll(()=>activeTool(page).locator('#timestamp-iso').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

for(const [width,height] of [[1440,900],[1366,768]])test(`primary form actions remain in the initial ${width}×${height} viewport`,async({page})=>{
 await page.setViewportSize({width,height});const failures=[];
 for(const [name,id]of [['cron','cron-run'],['password','password-generate'],['draw','draw-run'],['text','text-run'],['calculator','calculate']]){await page.goto(`/${name}.html`);const box=await activeTool(page).locator('#'+id).boundingBox();if(!box||box.y<72||box.y+box.height>height)failures.push({name,box});}
 expect(failures).toEqual([]);
});

test('header reflows at 200 percent text size on a 320px viewport',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 for(const file of ['index','qr']){
  await page.goto(`/${file}.html`);await page.addStyleTag({content:'html{font-size:200% !important}'});
  const header=page.locator('.app-header');
  expect(await header.evaluate(el=>el.scrollWidth-el.clientWidth),file).toBeLessThanOrEqual(1);
  await expect(page.locator('#settings-open')).toBeVisible();
 }
});

test('unpublished support illustration fits the 320px content column',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/support.html');
 const main=page.locator('main');expect(await main.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
});
