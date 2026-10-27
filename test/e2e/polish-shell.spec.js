import{test,expect}from'@playwright/test';
import{selectLanguage}from'./language-helpers.js';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});
for(const [query,target]of [['提取邮箱','text.html#extract-email'],['PDF提取','pdf.html#extract'],['base64解码','convert.html#base64-decode']])test(`task search ${query} opens the existing destination by keyboard`,async({page})=>{
 await page.goto('/index.html');await page.locator('#global-search-open').click();await page.locator('#tool-menu-search').fill(query);const first=page.locator('.tool-menu-list a').first();await expect(first).toHaveAttribute('data-target',target);await page.locator('#tool-menu-search').press('Enter');await page.waitForURL('**/'+target);await expect(page.locator('#tool-menu [aria-current=page]')).toHaveCount(1);
});
test('complete regex flags stay readable with help collapsed and survive language changes',async({page})=>{
 await page.goto('/regex.html');const field=page.locator('#regex-flags'),help=field.locator('xpath=ancestor::details[1]');await help.evaluate(n=>n.open=true);await field.fill('gu');await help.evaluate(n=>n.open=false);await expect(page.locator('#regex-active-flags')).toBeVisible();await expect(page.locator('#regex-active-flags')).toContainText('gu');
 await help.evaluate(n=>n.open=true);await field.fill('gsy');await help.evaluate(n=>n.open=false);await expect(page.locator('#regex-active-flags')).toContainText('gsy');await selectLanguage(page,'zh-Hans');await expect(page.locator('#regex-active-flags')).toBeVisible();await expect(page.locator('#regex-active-flags')).toContainText('gsy');await expect(field).toHaveValue('gsy');
});
