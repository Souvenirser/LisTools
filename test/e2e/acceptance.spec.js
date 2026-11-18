import {activeTool} from './task-helpers.js';
import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';
const ids=['calculator','dates','qr','images','text','units','money','pdf','draw','timer'];
for(const id of ids)test(`${id} loads offline with working header navigation and no browser exceptions`,async({page})=>{
 const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
 await page.goto(`/${id}.html`);await expect(activeTool(page).locator('.tool-heading h1')).toBeVisible();await expect(activeTool(page).locator('.tool-heading h1')).not.toHaveText(`${id}.name`);
 const search=page.locator('#tool-menu-search');if(!await search.isVisible())await page.locator('button.brand').click();await expect(page.locator('#tool-menu')).toBeVisible();await search.fill('pdf');await expect(page.locator('#tool-menu a[data-target="pdf.html"]').filter({visible:true})).toBeVisible();await page.keyboard.press('Escape');
 expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('all fifty UI languages preserve calculator input and an existing result',async({page})=>{
 await page.goto('/calculator.html');await activeTool(page).locator('#expression').fill('0.1+0.2');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#result')).toHaveText('0.3');
 const codes=await page.locator('#language option').evaluateAll(options=>options.map(option=>option.value));expect(codes).toHaveLength(50);
 for(const code of codes){await selectLanguage(page,code);await expect(page.locator('html')).toHaveAttribute('lang',code);await expect(activeTool(page).locator('.tool-heading h1')).not.toHaveText('calculator.name');await expect(activeTool(page).locator('#expression')).toHaveValue('0.1+0.2');await expect(activeTool(page).locator('#result')).toHaveText('0.3');}
});
test('narrow RTL layout keeps new tool controls within the viewport',async({page})=>{
 await page.setViewportSize({width:640,height:960});
 for(const id of ['calculator','images','pdf']){
  await page.goto(`/${id}.html`);await selectLanguage(page,'ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  for(const document of [page.locator('html'),activeTool(page).locator('html')])
   expect(await document.evaluate(root=>root.scrollWidth<=root.clientWidth+2),id).toBe(true);
 }
});
