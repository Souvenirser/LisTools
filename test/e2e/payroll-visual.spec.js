import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const evidence='.superpowers/sdd/social-tax-20261103/screenshots';
for(const theme of ['light','dark'])for(const locale of ['zh-Hans','en','de','ar'])for(const tool of ['insurance','tax'])test(`${tool} ${theme} ${locale}: real result, readable controls and accessible structure`,async({page})=>{
 await page.addInitScript(({theme,locale})=>{localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));localStorage.setItem('listools-language',locale);},{theme,locale});
 await page.setViewportSize({width:locale==='ar'?390:1440,height:900});await page.goto('/'+tool+'.html');await page.locator('html[data-ui-state="ready"]').waitFor();
 if(tool==='insurance'){
  const picker=page.locator('.insurance-picker .choices');await picker.click();await picker.locator('input[type=search]').fill('Beijing');await picker.locator('[data-choice-selectable][data-value="beijing"]').click();await page.locator('#insurance-month').fill('2026-11');await page.locator('#insurance-salary').fill('10000');await page.locator('#insurance-run').click();await expect(page.locator('[data-value="employeeTotal"]')).toHaveText('1753.00');
 }else{await page.locator('#tax-salary').fill('10000');await page.locator('#tax-month').fill('8');await page.locator('#tax-run').click();await expect(page.locator('[data-value="currentTax"]')).toHaveText('430.00');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('main').evaluate(n=>n.scrollTop=0);const scan=await new AxeBuilder({page}).include('#tool-root').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/${tool}-${theme}-${locale}-axe.json`,JSON.stringify({violations:scan.violations,incomplete:scan.incomplete},null,2));expect(scan.violations).toEqual([]);
 await page.locator('main').evaluate(n=>n.scrollTop=0);await page.screenshot({path:`${evidence}/${tool}-${theme}-${locale}.png`,fullPage:true});
});
