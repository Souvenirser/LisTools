import { test, expect } from '@playwright/test';
const ids=['calculator','dates','qr','images','text','units','money','pdf','draw','timer'];
for(const id of ids)test(`${id} loads offline with working header navigation and no browser exceptions`,async({page})=>{
 const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
 await page.goto(`/${id}.html`);await expect(page.locator('.tool-heading h1')).toBeVisible();await expect(page.locator('.tool-heading h1')).not.toHaveText(`${id}.name`);
 await page.locator('button.brand').click();await expect(page.locator('#tool-menu')).toBeVisible();await page.locator('#tool-menu-search').fill('pdf');await expect(page.locator('#tool-menu a[data-target="pdf.html"]')).toBeVisible();await page.keyboard.press('Escape');
 expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('all fifty UI languages preserve calculator input and an existing result',async({page})=>{
 await page.goto('/calculator.html');await page.locator('#expression').fill('0.1+0.2');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('0.3');
 const codes=await page.locator('#language option').evaluateAll(options=>options.map(option=>option.value));expect(codes).toHaveLength(50);
 for(const code of codes){await page.locator('#language').selectOption(code);await expect(page.locator('html')).toHaveAttribute('lang',code);await expect(page.locator('.tool-heading h1')).not.toHaveText('calculator.name');await expect(page.locator('#expression')).toHaveValue('0.1+0.2');await expect(page.locator('#result')).toHaveText('0.3');}
});
test('narrow RTL layout keeps new tool controls within the viewport',async({page})=>{
 await page.setViewportSize({width:640,height:960});
 for(const id of ['calculator','images','pdf']){
  await page.goto(`/${id}.html`);await page.locator('#language').selectOption('ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),id).toBe(true);
 }
});
