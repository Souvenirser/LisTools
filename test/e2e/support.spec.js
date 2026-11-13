import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('support entry stays hidden without removing the page or current tool input',async({page})=>{
  await page.goto('/index.html');
  const source=page.frameLocator('iframe[data-workspace-active]').locator('#source .cm-content');
  await source.fill('{"keep":"my input"}');
  const link=page.locator('.tool-menu-footer .tool-menu-support');
  await expect(link).toHaveCount(1);await expect(link).toHaveAttribute('href','./support.html');await expect(link).toBeHidden();
  await selectLanguage(page,'zh-Hans');await expect(link).toBeHidden();await expect(source).toHaveText('{"keep":"my input"}');
  await page.setViewportSize({width:390,height:844});await page.locator('button.brand').click();await expect(link).toBeHidden();await expect(page.locator('.tool-menu-footer')).toBeVisible();
});

test('popup hides support while keeping version and feedback visible',async({page})=>{
  await page.goto('/popup.html');
  const link=page.locator('.tool-menu-footer .tool-menu-support');
  await expect(link).toHaveCount(1);await expect(link).toHaveAttribute('href','./support.html');await expect(link).toBeHidden();
  await expect(page.locator('#app-version')).toBeVisible();await expect(page.locator('.tool-menu-footer .feedback-link')).toBeVisible();
});

test('support stays local and readable in Chinese and RTL at narrow widths',async({page,baseURL})=>{
  const external=[];
  page.on('request',request=>{if(/^https?:/.test(request.url()) && new URL(request.url()).origin!==new URL(baseURL).origin)external.push(request.url());});
  await page.goto('/support.html');
  await selectLanguage(page,'zh-Hans');
  await expect(page.locator('#support-card')).toContainText('金额随心');
  await expect(page.locator('#support-card')).not.toContainText(/建议支持|最低金额|1\s*元|¥\s*1/);
  await expect(page.locator('#support-card input')).toHaveCount(0);
  for(const width of [320,640]){
    await page.setViewportSize({width,height:760});
    await selectLanguage(page,'ar');
    await expect(page.locator('html')).toHaveAttribute('dir','rtl');
    await expect(page.locator('h1')).not.toHaveText('Buy the author a coffee');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('button.brand').click();
    const link=page.locator('#tool-menu .tool-menu-footer a[href="./support.html"]');
    await expect(link).toBeHidden();
    await expect(page.locator('.tool-menu-footer')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  expect(external).toEqual([]);
});
