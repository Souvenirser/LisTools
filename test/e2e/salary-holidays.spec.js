import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import AxeBuilder from '@axe-core/playwright';
test.use({timezoneId:'Asia/Shanghai'});
async function open(page,time){await page.clock.setFixedTime(new Date(time));await page.goto('/salary.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await selectLanguage(page,'zh-Hans');}
test('National Day and makeup work are labelled and affect earnings only after confirmed save',async({page})=>{
 await open(page,'2026-10-08T10:00:00+08:00');const holiday=page.locator('[data-salary-date="2026-10-01"]'),makeup=page.locator('[data-salary-date="2026-10-10"]');await expect(holiday).toContainText('国庆节');await expect(makeup).toContainText('补班');await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();const before=await page.locator('#salary-earned').textContent();
 await page.locator('#salary-apply-holidays').click();await expect(holiday).toHaveAttribute('data-work','false');await expect(makeup).toHaveAttribute('data-work','true');await expect(page.locator('#salary-earned')).toHaveText(before);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')).overrides)).toEqual({});
 await page.locator('#salary-save').click();await expect(page.locator('#salary-confirm')).toBeVisible();await page.locator('#salary-confirm-apply').click();await expect(page.locator('#salary-earned')).not.toHaveText(before);await page.reload();await expect(page.locator('[data-salary-date="2026-10-01"]')).toHaveAttribute('data-work','false');await expect(page.locator('[data-salary-date="2026-10-10"]')).toHaveAttribute('data-work','true');
});
test('Spring Festival application preserves a monthly rest target and reports a count conflict',async({page})=>{
 await open(page,'2026-02-18T10:00:00+08:00');await page.locator('#salary-mode').selectOption('monthly');await page.locator('#salary-monthly-rest').fill('2');await expect(page.locator('[data-salary-date="2026-02-18"]')).toContainText('春节');await page.locator('#salary-apply-holidays').click();await expect(page.locator('#salary-monthly-rest')).toHaveValue('2');await expect(page.locator('#salary-calendar [aria-pressed=true]')).toHaveCount(9);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-calendar-error')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('listools-salary-v1'))).toBeNull();
});
test('missing published data is distinct from a known month without public holidays',async({page})=>{
 await open(page,'2027-02-02T10:00:00+08:00');await expect(page.locator('#salary-apply-holidays')).toBeDisabled();await expect(page.locator('#salary-holiday-info')).toContainText('未内置 2027');await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+08:00'));await page.reload();await expect(page.locator('#salary-apply-holidays')).toBeDisabled();await expect(page.locator('#salary-holiday-info')).toContainText('本月没有');
});
test('holiday badges and the shared timezone picker pass WCAG A and AA checks',async({page})=>{
 await open(page,'2026-10-08T10:00:00+08:00');await page.locator('#salary-amount').fill('16800');await page.locator('#salary-apply-holidays').click();await page.locator('#salary-save').click();await page.locator('#salary-bar-toggle').click();const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(results.violations.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)}))).toEqual([]);
});
