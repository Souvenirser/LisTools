import {selectLanguage} from './language-helpers.js';
import {test,expect} from '@playwright/test';
import {pages} from '../../src/tools/shared/navigation.js';
import {readFileSync} from 'node:fs';

const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url)));
const entries=pages.filter(item=>!item.file.includes('#'));
test('every tool footer exposes one public feedback link without contacting GitHub on load',async({page})=>{
  const external=[];page.on('request',request=>{if(request.url().startsWith('https://'))external.push(request.url());});
  for(const entry of entries){
    await page.goto(`/${entry.file}`);
    const link=page.locator('.workbench-footer a.feedback-link');await expect(link).toBeVisible();await expect(link).toHaveCount(1);
    const url=new URL(await link.getAttribute('href'));
    expect(url.pathname).toBe('/Souvenirser/LisTools/issues/new');expect(url.searchParams.get('version')).toBe(pkg.version);
    expect(url.searchParams.get('tool')).toContain(`(${entry.id==='convert'?'base64':entry.id})`);
    await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer');
  }
  expect(external).toEqual([]);
});
test('conversion context and language update without including input or leaking raw hashes',async({page})=>{
  await page.goto('/convert.html#base64');await selectLanguage(page,'zh-Hans');
  await page.locator('#convert-source .cm-content').fill('FEEDBACK_SECRET_INPUT');
  const link=page.locator('.workbench-footer a.feedback-link');
  await expect(link).toHaveText('问题反馈 ↗');
  await page.evaluate(()=>{location.hash='#hex';});
  await expect.poll(async()=>new URL(await link.getAttribute('href')).searchParams.get('tool')).toContain('(hex)');
  await selectLanguage(page,'en');await expect(link).toHaveText('Report an issue ↗');
  expect(new URL(await link.getAttribute('href')).searchParams.get('locale')).toBe('en');
  expect(await link.getAttribute('href')).not.toContain('FEEDBACK_SECRET');
  await page.evaluate(()=>{location.hash='#FEEDBACK_SECRET_HASH';});
  await expect.poll(async()=>new URL(await link.getAttribute('href')).searchParams.get('tool')).toContain('(base64)');
  expect(await link.getAttribute('href')).not.toContain('FEEDBACK_SECRET');
});
test('keyboard feedback opens a separate tab and preserves the original input',async({page,context})=>{
  await context.route('https://github.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Feedback destination</title>'}));
  await page.goto('/index.html');await page.locator('#source .cm-content').fill('{"synthetic":"FEEDBACK_SECRET_INPUT"}');
  const link=page.locator('.workbench-footer a.feedback-link');await link.focus();
  const opened=context.waitForEvent('page');await page.keyboard.press('Enter');const tab=await opened;
  await tab.waitForLoadState();expect(tab.url()).toContain('https://github.com/Souvenirser/LisTools/issues/new?');
  expect(tab.url()).not.toContain('FEEDBACK_SECRET');await expect.poll(()=>page.locator('#source').evaluate(node=>node.value)).toEqual('{"synthetic":"FEEDBACK_SECRET_INPUT"}');
  await tab.close();
});
test('feedback stays available in narrow RTL pages and the toolbar popup',async({page})=>{
  await page.setViewportSize({width:375,height:900});
  await page.goto('/index.html');await selectLanguage(page,'ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const link=page.locator('.workbench-footer a.feedback-link');await link.scrollIntoViewIfNeeded();await expect(link).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.goto('/popup.html');const popup=page.locator('.tool-menu-footer a.feedback-link');await expect(popup).toBeVisible();
  const url=new URL(await popup.getAttribute('href'));expect(url.searchParams.get('tool')).toContain('(toolbox)');
  expect(await popup.getAttribute('data-target')).toBeNull();
  await page.locator('#tool-menu-search').fill('FEEDBACK_SECRET_SEARCH');await expect(popup).toBeVisible();
  expect(await popup.getAttribute('href')).not.toContain('FEEDBACK_SECRET');
});
