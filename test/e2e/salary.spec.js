import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import {activeTool} from './task-helpers.js';
test.use({timezoneId:'Asia/Shanghai'});
const salaryKey='listools-salary-v1';
async function open(page){await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+08:00'));await page.goto('/salary.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');}
async function enable(page){await open(page);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');await page.locator('#salary-bar-toggle').click();await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','true');}

test('salary page offers an empty wage with eight-hour five-on-two-off defaults',async({page})=>{
 await open(page);await expect(page.locator('#salary-amount')).toHaveValue('');await expect(page.locator('#salary-hours')).toHaveValue('8');await expect(page.locator('#salary-work-days')).toHaveValue('5');await expect(page.locator('#salary-rest-days')).toHaveValue('2');await expect(page.locator('#salary-earned')).toHaveText('—');expect(await page.evaluate(key=>localStorage.getItem(key),salaryKey)).toBeNull();
});
test('explicit enable backfills the same estimate into the footer and freezes in unpaid lunch',async({page})=>{
 await enable(page);await expect(page.locator('#salary-bar [data-salary-earned]')).toHaveText('¥100.0000');await page.clock.setFixedTime(new Date('2026-11-02T12:30:00+08:00'));await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.locator('#salary-earned')).toHaveText('¥300.0000');await expect(page.locator('#salary-state')).toHaveAttribute('data-state','lunch');
 const data=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),salaryKey);expect(data.salary).toBe('16800');expect(data.earned).toBeUndefined();
});
test('draft changes require explicit confirmed save and survive an external config change',async({page,context})=>{
 await enable(page);await page.locator('#salary-amount').fill('20000');await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
 const other=await context.newPage();await open(other);await other.locator('#salary-amount').fill('33600');await other.locator('#salary-save').click();await expect(other.locator('#salary-confirm')).toBeVisible();await other.locator('#salary-confirm-apply').click();await expect(page.locator('#salary-earned')).toHaveText('¥200.0000');await expect(page.locator('#salary-amount')).toHaveValue('20000');await expect(page.locator('#salary-draft-notice')).toBeVisible();
});
test('fixed monthly rest dates require confirmation and a new month waits for its calendar',async({page})=>{
 await open(page);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-mode').selectOption('monthly');await page.locator('#salary-monthly-rest').fill('1');await page.locator('#salary-save').click();await expect(page.locator('#salary-calendar-error')).toBeVisible();
 await page.locator('[data-salary-date="2026-11-01"]').click();await page.locator('#salary-save').click();await expect(page.locator('#salary-state')).toHaveAttribute('data-state','working');
 await page.clock.setFixedTime(new Date('2026-12-01T00:00:00+08:00'));await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.locator('#salary-earned')).toHaveText('—');await expect(page.locator('#salary-state')).toHaveAttribute('data-state','pending');
});
test('cycle month rollover resets income without restarting the cycle or forgetting settings',async({page})=>{
 await enable(page);await page.clock.setFixedTime(new Date('2026-11-30T23:59:59+08:00'));await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.locator('#salary-earned')).toHaveText('¥16800.0000');await page.clock.setFixedTime(new Date('2026-12-01T00:00:00+08:00'));await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(page.locator('#salary-earned')).toHaveText('¥0.0000');await page.reload();await expect(page.locator('#salary-amount')).toHaveValue('16800');
});
test('wage stays local and feedback only includes static tool metadata',async({page,baseURL})=>{
 const requests=[];page.on('request',req=>{if(/^https?:/.test(req.url())&&new URL(req.url()).origin!==new URL(baseURL).origin)requests.push(req.url());});await enable(page);expect(requests).toEqual([]);const link=await page.locator('.page-feedback-link,.feedback-link').first().getAttribute('href');expect(link).not.toContain('16800');expect(link).toContain('salary');expect(page.url()).not.toContain('16800');
});
test('local storage failure visibly preserves current-page session and clearing requires confirmation',async({page})=>{
 await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='listools-salary-v1')throw Error('blocked');return set.call(this,k,v);};});await enable(page);await expect(page.locator('#tool-status')).toContainText(/not saved|未保存/i);await page.locator('#salary-clear').click();await expect(page.locator('#salary-confirm')).toBeVisible();await page.locator('#salary-confirm-cancel').click();await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
});
test('footer in another tool preserves its input and can hide amounts or disable the bar',async({page,context})=>{
 await enable(page);const other=await context.newPage();await other.goto('/index.html');await expect(other.locator('#salary-bar')).toBeVisible();const input=activeTool(other).locator('#source .cm-content');await input.fill('{"synthetic":"keep"}');await page.locator('#salary-mask').click();await expect(other.locator('#salary-bar [data-salary-earned]')).toHaveText('¥••••');await expect(input).toHaveText('{"synthetic":"keep"}');await other.locator('#salary-bar-hide').click();await expect(other.locator('#salary-bar')).toBeHidden();await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','false');
});
test('unsupported PiP is explained without losing the estimate',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'documentPictureInPicture',{value:undefined,configurable:true}));await enable(page);await page.locator('#salary-pip').click();await expect(page.locator('#tool-status')).toContainText(/not support|不支持/i);await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
});
for(const width of [320,390,768,1366,1920])test(`salary layout at ${width}px keeps the calendar and footer within their bounds`,async({page})=>{
 await page.setViewportSize({width,height:900});await enable(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const bar=await page.locator('#salary-bar').boundingBox();expect(bar.y+bar.height).toBeLessThanOrEqual(901);await expect(page.locator('#salary-calendar button').first()).toBeVisible();
});
test('language, RTL and larger text preserve the saved wage and calendar',async({page})=>{
 await page.setViewportSize({width:390,height:900});await enable(page);await selectLanguage(page,'zh-Hans');await expect(page.locator('h1')).toHaveText('牛马激励');await selectLanguage(page,'ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await page.addStyleTag({content:'html{font-size:200% !important}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.locator('#salary-amount')).toHaveValue('16800');
});
test('calendar shortcuts report invalid draft fields without an unhandled exception',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await open(page);await page.locator('#salary-work-days').fill('0');await page.locator('#salary-weekends').click();await expect(page.locator('#salary-work-days-error')).toBeVisible();expect(errors).toEqual([]);
});
test('switching from an invalid cycle draft to monthly rest validates only the active mode',async({page})=>{
 await open(page);await page.locator('#salary-work-days').fill('0');await page.locator('#salary-anchor').fill('');await page.locator('#salary-mode').selectOption('monthly');await page.locator('#salary-monthly-rest').fill('0');await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-state')).toHaveAttribute('data-state','working');await page.reload();await expect(page.locator('#salary-state')).toHaveAttribute('data-state','working');
});
test('failed persistent removal can be retried without deleting other settings',async({page})=>{
 await page.addInitScript(()=>{const remove=Storage.prototype.removeItem;let fail=true;Storage.prototype.removeItem=function(key){if(key==='listools-salary-v1'&&fail){fail=false;throw Error('temporary denial');}return remove.call(this,key);};localStorage.setItem('synthetic-other-tool','keep');});await enable(page);await page.locator('#salary-clear').click();await page.locator('#salary-confirm-apply').click();await expect(page.locator('#tool-status')).toContainText(/Could not clear|无法清除/i);await expect(page.locator('#salary-clear')).toBeEnabled();await page.locator('#salary-clear').click();await page.locator('#salary-confirm-apply').click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('listools-salary-v1'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('synthetic-other-tool'))).toBe('keep');
});
for(const width of [320,390,768,1366,1920])test(`enabled footer leaves JSON, convert, text and regex actions and focus workspace unobscured at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await enable(page);
 for(const file of ['index.html','convert.html#base64','text.html','regex.html']){
  await page.goto('/'+file);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.locator('#salary-bar')).toBeVisible();
  const tool=activeTool(page),focus=tool.locator('#workspace-focus');
  const layout=await page.locator('.app-layout').boundingBox(),bar=await page.locator('#salary-bar').boundingBox(),action=await tool.locator('.workspace-action-fixed').first().count()?await tool.locator('.workspace-action-fixed').first().boundingBox():null;
  expect(layout.y+layout.height,file).toBeLessThanOrEqual(bar.y+1);if(action)expect(action.y+action.height,file).toBeLessThanOrEqual(bar.y+1);
  if(await focus.isVisible()){
   await focus.click();await expect(page.locator('body')).toHaveClass(/workspace-focused/);
   await expect.poll(async()=>{const box=await page.locator('.app-layout').boundingBox(),footer=await page.locator('#salary-bar').boundingBox();return Math.abs(box.y+box.height-footer.y);}, {message:file+' focus viewport excludes only the salary bar'}).toBeLessThanOrEqual(2);
   await focus.click();
  }
 }
});
test('calendar work and rest labels resolve and remain part of the accessible button name',async({page})=>{
 await open(page);const rest=page.locator('[data-salary-date="2026-11-01"]'),work=page.locator('[data-salary-date="2026-11-02"]');await expect(rest.locator('small')).toHaveText('Rest');await expect(work.locator('small')).toHaveText('Work');await expect(rest).toHaveAccessibleName(/1 Rest/);await expect(work).toHaveAccessibleName(/2 Work/);
});
test('footer display button persists visibility without changing the salary estimate',async({page})=>{
 await enable(page);await page.locator('#salary-bar-toggle').click();await expect(page.locator('#salary-bar')).toBeHidden();await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')).showBar)).toBe(false);await page.reload();await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','false');
});
