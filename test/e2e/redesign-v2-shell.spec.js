import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
test('V2 shell exposes global search and shared sidebar without losing current input',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/calculator.html');await selectLanguage(page,'en');await page.locator('#expression').fill('123+456');await expect(page.locator('#global-search-open')).toBeVisible({timeout:1500});await expect(page.locator('#tool-menu')).toHaveClass(/is-sidebar/);await page.keyboard.press('ControlOrMeta+k');await expect(page.locator('#tool-menu-search')).toBeFocused();await page.locator('#tool-menu-search').fill('pdf');await expect(page.locator('.tool-menu-list a').first()).toContainText(/PDF/);await page.keyboard.press('Escape');await expect(page.locator('#expression')).toHaveValue('123+456');
});
test('V2 settings theme updates the page while preserving input and syncs to a second page',async({page,context})=>{
 await page.goto('/money.html');await selectLanguage(page,'en');await page.locator('#money-input').fill('123.45');await expect(page.locator('#settings-open')).toBeVisible({timeout:1500});await page.locator('#settings-open').click();await page.locator('#theme-preference').selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('#settings-close').click();await expect(page.locator('#money-input')).toHaveValue('123.45');const other=await context.newPage();await other.goto('/qr.html');await expect(other.locator('html')).toHaveAttribute('data-theme','dark');
});

test('V2 safe options survive pages without persisting tool content',async({page})=>{
 await page.goto('/qr.html');await page.locator('#qr-input').fill('private text');await page.locator('details:has(#qr-size)>summary').click();await page.locator('#qr-size').fill('480');await page.locator('#qr-size').dispatchEvent('change');await page.locator('#qr-level').selectOption('H');await page.reload();await expect(page.locator('#qr-size')).toHaveValue('480');await expect(page.locator('#qr-level')).toHaveValue('H');await expect(page.locator('#qr-input')).toBeEmpty();
 await page.goto('/units.html');await page.locator('#unit-category').selectOption('temperature');await page.reload();await expect(page.locator('#unit-category')).toHaveValue('temperature');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-preferences-v1')));expect(JSON.stringify(saved)).not.toContain('private text');
});
