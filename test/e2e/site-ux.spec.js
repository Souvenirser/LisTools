import {chooseConversionTool} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('shared reading scale, task widths and calculator proportions',async({page})=>{
  await page.setViewportSize({width:2560,height:1440});
  for(const [file,max] of [['qr',1600],['dates',1120],['calculator',1244],['timer',960],['money',1120]]){
    await page.goto(`/${file}.html`);
    expect(await page.locator('main').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),file).toBe(16);
    const root=page.locator('#tool-root');
    expect((await root.boundingBox()).width,file).toBeLessThanOrEqual(max+1);
    expect(await page.locator('h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),file).toBe(28);
  }
  await page.goto('/calculator.html');
  expect((await page.locator('.calculator-workbench').boundingBox()).width).toBeLessThanOrEqual(480);
});

test('date tasks preserve independent input and results through task and language changes',async({page})=>{
  await page.goto('/dates.html');
  await page.locator('#date-start').fill('2024-02-28');await page.locator('#date-end').fill('2024-03-01');
  await page.locator('#difference-run').click();await expect(page.locator('#difference-output')).toContainText('2');
  await page.locator('#dates-task-shift').click();await expect(page.locator('#date-start')).toBeHidden();
  await page.locator('#date-base').fill('2024-01-31');await page.locator('#date-unit').selectOption('months');await page.locator('#date-amount').fill('1');
  await page.locator('#shift-run').click();await expect(page.locator('#shift-output')).toContainText('2024-02-29');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#dates-task-select').selectOption('difference');await selectLanguage(page,'de');
  await expect(page.locator('#date-start')).toHaveValue('2024-02-28');await expect(page.locator('#difference-output')).toContainText('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('money begins blank and converts only on explicit action',async({page})=>{
  await page.goto('/money.html');await expect(page.locator('#money-input')).toHaveValue('');await expect(page.locator('#money-simplified')).toBeEmpty();
  await page.locator('#money-input').fill('12.34');await expect(page.locator('#money-simplified')).toBeEmpty();
  await page.locator('#money-input').press('Enter');await expect(page.locator('#money-simplified')).not.toBeEmpty();
});

test('compact tool selection frees the entire conversion workspace',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/convert.html#base64');
 await expect(page.locator('#convert-catalog-toggle')).toBeVisible();await expect(page.locator('.convert-catalog')).toBeHidden();
 await page.locator('#convert-catalog-toggle').click();await page.locator('#convert-search').fill('JSON');await expect(page.locator('#convert-tool-list a').first()).toBeVisible();
 await chooseConversionTool(page,'#convert-tool-list a[href="#json-yaml"]');await expect(page.locator('.convert-catalog')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('MD5 primary action is before editors and secondary formats are collapsed',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/convert.html#md5');
 const run=await page.locator('#md5-run').boundingBox();expect(run.y+run.height).toBeLessThan(700);
 await expect(page.locator('#md5-other-formats')).not.toHaveAttribute('open','');
 await expect(page.locator('#md5-value-hex32lower')).toBeVisible();await expect(page.locator('#md5-value-base64')).toBeHidden();
});

test('all six text tasks expose their own options',async({page})=>{
 await page.goto('/text.html');await page.locator('#text-input').fill('hello world');
 await page.locator('#text-task-case').click();await expect(page.locator('#text-case')).toBeVisible();await expect(page.locator('#text-kind')).toBeHidden();
 await expect(page.locator('#text-input')).toHaveValue('hello world');await page.locator('#text-task-newline').click();await expect(page.locator('#text-newline')).toBeVisible();
});

test('duration inputs adapt seconds and prevent changes while running',async({page})=>{
 await page.goto('/timer.html');await page.locator('#timer-minutes').fill('1');await page.locator('#timer-seconds').fill('2');await page.locator('#timer-seconds').blur();
 await expect(page.locator('#timer-duration')).toHaveValue('62');await page.locator('#timer-start').click();await expect(page.locator('#timer-minutes')).toBeDisabled();
 await page.locator('#timer-pause').click();await expect(page.locator('#timer-minutes')).toBeEnabled();await page.locator('#timer-seconds').fill('5');await page.locator('#timer-seconds').blur();await expect(page.locator('#timer-duration')).toHaveValue('65');
 await page.reload();await expect(page.locator('#timer-duration')).toHaveValue('65');
 await page.locator('#timer-task-stopwatch').click();await expect(page.locator('#timer-duration-field')).toBeHidden();await expect(page.locator('#timer-lap')).toBeVisible();
});

test('list and integer draws expose one task at a time without losing the list',async({page})=>{
 await page.goto('/draw.html');await page.locator('#draw-input').fill('Alice\nBob\nAlice');
 await page.locator('#draw-task-numbers').click();await expect(page.locator('#draw-input')).toBeHidden();await page.locator('#draw-number-run').click();await expect(page.locator('#draw-result')).not.toBeEmpty();
 await page.locator('#draw-task-list').click();await expect(page.locator('#draw-input')).toHaveValue('Alice\nBob\nAlice');await expect(page.locator('#draw-number-run')).toBeHidden();
});

test('language changes preserve the selected regex match and editor selection',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-pattern').fill('ORDER-\\d+');await page.locator('#regex-source .cm-content').fill('ORDER-1 ORDER-2');await page.locator('#regex-run').click();await expect(page.locator('#regex-match-rows tr')).toHaveCount(2);await page.locator('#regex-next').click();
 await expect(page.locator('#regex-match-rows button[aria-current]')).toHaveText('2');
 const selection=await page.locator('#regex-source').evaluate(node=>{const range=getSelection();return range?.toString();});
 await selectLanguage(page,'zh-Hans');await expect(page.locator('#regex-match-rows button[aria-current]')).toHaveText('2');
 await page.locator('#regex-source .cm-content').focus();expect(await page.locator('#regex-source').evaluate(()=>getSelection()?.toString())).toBe(selection);
});

test('timestamp result fields show complete values on narrow screens',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/timestamp.html');await page.locator('#timestamp-source').fill('1704067200123');
 await expect(page.locator('#timestamp-iso')).not.toHaveValue('');await page.locator('#timestamp-more-formats summary').click();await expect(page.locator('#timestamp-iso')).toBeVisible();
 expect(await page.locator('#timestamp-iso').evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

for(const [width,height] of [[1440,900],[1366,768]])test(`primary form actions remain in the initial ${width}×${height} viewport`,async({page})=>{
 await page.setViewportSize({width,height});const failures=[];
 for(const [name,id]of [['cron','cron-run'],['password','password-generate'],['draw','draw-run'],['text','text-run'],['calculator','calculate']]){await page.goto(`/${name}.html`);const box=await page.locator('#'+id).boundingBox();if(!box||box.y<72||box.y+box.height>height)failures.push({name,box});}
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

