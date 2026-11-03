import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {chooseTask} from './task-helpers.js';

async function controlsAlign(page,ids){
 const boxes=await Promise.all(ids.map(id=>page.locator('#'+id).boundingBox()));
 for(const box of boxes){expect(box).not.toBeNull();expect(Math.abs(box.y-boxes[0].y)).toBeLessThanOrEqual(1);}
}
for(const language of ['en','de','ar'])for(const width of [390,1440])test(`date labels and controls align in ${language} at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(language=>{localStorage.setItem('listools-language',language);localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'}));},language);
 await page.goto('/dates.html#shift');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 await controlsAlign(page,['date-base','date-amount']);
 const unit=await page.locator('#date-unit').locator('..').boundingBox(),base=await page.locator('#date-base').locator('..').boundingBox();if(Math.abs(unit.y-base.y)<=1)await controlsAlign(page,['date-base','date-amount','date-unit']);
 await page.locator('#date-amount').fill('1.5');await page.locator('#shift-run').click();await expect(page.locator('#date-amount-error')).toBeVisible();await controlsAlign(page,['date-base','date-amount']);
 await page.locator('#date-amount').fill('7');await page.locator('#shift-run').click();await expect(page.locator('#shift-copy')).toBeEnabled();
 await chooseTask(page,'dates','milestone');await controlsAlign(page,['date-origin','date-reference']);
 await chooseTask(page,'dates','difference');await page.locator('#date-start').fill('');await page.locator('#difference-run').click();await expect(page.locator('#date-start-error')).toBeVisible();await controlsAlign(page,['date-start','date-end']);await controlsAlign(page,['date-today-start','date-today-end']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('German find and replacement fields share the control row and keep errors below it',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.addInitScript(()=>localStorage.setItem('listools-language','de'));await page.goto('/text.html#replace');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 await controlsAlign(page,['text-find','text-replacement']);await page.locator('#text-input').fill('alpha');await page.locator('#text-run').click();await expect(page.locator('#text-find-error')).toBeVisible();await controlsAlign(page,['text-find','text-replacement']);
 const scan=await new AxeBuilder({page}).include('#tool-status').withRules(['scrollable-region-focusable']).analyze();expect(scan.violations).toEqual([]);
});
for(const language of ['de','ar'])test(`replacement controls remain fully reachable at 320px in ${language}`,async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.addInitScript(language=>localStorage.setItem('listools-language',language),language);await page.goto('/text.html#replace');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 for(const id of ['text-find','text-replacement']){const box=await page.locator('#'+id).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320);}
 await page.locator('#text-input').fill('alpha');await page.locator('#text-find').fill('alpha');await page.locator('#text-replacement').fill('beta');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('beta');
});
