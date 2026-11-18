import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const evidence='.superpowers/sdd/social-tax-20261103/screenshots';
for(const theme of ['light','dark'])for(const locale of ['zh-Hans','en','de','ar'])for(const tool of ['insurance','tax'])test(`${tool} ${theme} ${locale}: real result, readable controls and accessible structure`,async({page})=>{
 await page.addInitScript(({theme,locale})=>{localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));localStorage.setItem('listools-language',locale);},{theme,locale});
 await page.clock.setFixedTime(new Date('2026-12-15T12:00:00Z'));
 await page.setViewportSize({width:locale==='ar'?390:1440,height:900});await page.goto('/'+tool+'.html');const f=page.frameLocator('iframe[data-workspace-active]');await f.locator('#tool-root').waitFor();await expect(f.locator('html')).toHaveAttribute('lang',locale);await expect(f.locator('html')).toHaveAttribute('data-theme',theme);
 if(tool==='insurance'){
  const picker=f.locator('.insurance-picker .choices');await picker.click();await picker.locator('input[type=search]').fill('Beijing');await picker.locator('[data-choice-selectable][data-value="beijing"]').click();await f.locator('#insurance-month').fill('2026-11');await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-run').click();await expect(f.locator('[data-value="employeeTotal"]')).toHaveText(locale==='de'?'2.253,00':'2,253.00');
 }else{await f.locator('#tax-salary').fill('10000');await f.locator('#tax-period').fill('2026-08');await f.locator('#tax-source').selectOption('manual');await f.locator('#tax-contributions').fill('0');await f.locator('#tax-run').click();await expect(f.locator('[data-value="currentTax"]')).toHaveText(locale==='de'?'430,00':'430.00');}
 for(const root of [page.locator('html'),f.locator('html')])expect(await root.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
 await f.locator('main').evaluate(n=>n.scrollTop=0);const scan=await new AxeBuilder({page}).include(['iframe[data-workspace-active]','#tool-root']).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/${tool}-${theme}-${locale}-axe.json`,JSON.stringify({violations:scan.violations,incomplete:scan.incomplete},null,2));expect(scan.violations).toEqual([]);
 await f.locator('main').evaluate(n=>n.scrollTop=0);await page.screenshot({path:`${evidence}/${tool}-${theme}-${locale}.png`,fullPage:true});
});
