import {test,expect} from '@playwright/test';
import {activeTool} from './task-helpers.js';

test.use({timezoneId:'Asia/Shanghai'});
const now=new Date('2026-11-02T10:00:00+08:00');
async function pickSalary(page){
 await page.locator('button.brand').click();
 await page.locator('#tool-menu-search').fill('牛马激励');
 await page.locator('#tool-menu a[data-target="salary.html"]').click();
}

test('a clean workspace opens the salary dashboard as the top-level page',async({page})=>{
 await page.goto('/index.html');
 await expect(activeTool(page).locator('#source .cm-content')).toBeVisible();
 await pickSalary(page);
 await expect(page).toHaveURL(/salary\.html$/);
 await expect(page.locator('#salary-form')).toBeVisible();
 await expect(page.locator('iframe[data-workspace-active]')).toHaveCount(0);
 await page.goBack();
 await expect(activeTool(page).locator('#source .cm-content')).toBeVisible();
});

test('a workspace draft stays when the salary dashboard opens in a new tab',async({page,context})=>{
 await page.goto('/index.html');
 const input=activeTool(page).locator('#source .cm-content');
 await input.fill('{"synthetic":"keep"}');
 const opened=context.waitForEvent('page');
 await pickSalary(page);
 const dashboard=await opened;
 await expect(dashboard).toHaveURL(/salary\.html$/);
 await expect(dashboard.locator('#salary-form')).toBeVisible();
 await expect(input).toHaveText('{"synthetic":"keep"}');
});

test('only the workbench shell mounts the opt-in bar and reserves space for it',async({page,context})=>{
 await page.clock.setFixedTime(now);
 await page.goto('/salary.html');
 await page.locator('#salary-amount').fill('16800');
 await page.locator('#salary-save').click();
 await page.locator('#salary-bar-toggle').click();

 const other=await context.newPage();
 await other.setViewportSize({width:390,height:740});
 await other.clock.setFixedTime(now);
 await other.goto('/index.html');
 const bar=other.locator('#salary-bar');
 await expect(bar.locator('[data-salary-earned]')).toHaveText('¥100.0000');
 const f=activeTool(other),editor=f.locator('#source .cm-content');
 await expect(f.locator('#salary-bar')).toHaveCount(0);
 async function noOverlap(){
  const [tool,bottom]=await Promise.all([other.locator('iframe[data-workspace-active]').boundingBox(),bar.boundingBox()]);
  return tool.y+tool.height<=bottom.y+1;
 }
 await expect.poll(noOverlap).toBe(true);
 await editor.fill('{"synthetic":true}');
 await f.locator('#workspace-focus').click();
 await expect(other.locator('body')).toHaveClass(/workspace-focused/);
 await expect.poll(noOverlap).toBe(true);
 await bar.locator('#salary-bar-hide').click();
 await expect(bar).toBeHidden();
 await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','false');
 await expect(editor).toHaveText('{"synthetic":true}');
});

test('opening salary preserves a draft from another tool in browser history',async({page,context})=>{
 await page.goto('/index.html');
 await expect(activeTool(page).locator('#source .cm-content')).toBeVisible();
 await page.locator('button.brand').click();
 await page.locator('#tool-menu-search').fill('regex');
 await page.locator('#tool-menu a[data-target="regex.html"]').click();
 const draft=activeTool(page).locator('#regex-source .cm-content');
 await draft.fill('keep this draft');
 await page.goBack();
 await expect(activeTool(page).locator('#source .cm-content')).toBeVisible();
 const opened=context.waitForEvent('page',{timeout:8000});
 await pickSalary(page);
 const dashboard=await opened;
 await expect(dashboard.locator('#salary-form')).toBeVisible();
 await expect(page).toHaveURL(/index\.html$/);
 await page.goForward();
 await expect(draft).toHaveText('keep this draft');
});

test('a wage bar mounted by another tab stays inert while a tool modal is open',async({page,context})=>{
 await page.clock.setFixedTime(now);
 await page.goto('/salary.html');
 await page.locator('#salary-amount').fill('16800');
 await page.locator('#salary-save').click();
 const tax=await context.newPage();
 await tax.goto('/tax.html');
 await activeTool(tax).locator('#tax-help').click();
 await expect(tax.locator('body')).toHaveClass(/workspace-modal-open/);
 await page.locator('#salary-bar-toggle').click();
 const bar=tax.locator('#salary-bar');
 await expect(bar).toBeVisible();
 await expect.poll(()=>bar.evaluate(node=>Boolean(node.closest('[inert]')))).toBe(true);
 await activeTool(tax).locator('#tax-assistant-close').click();
 await expect.poll(()=>bar.evaluate(node=>Boolean(node.closest('[inert]')))).toBe(false);
 await bar.locator('#salary-bar-hide').click();
 await expect(bar).toBeHidden();
});
