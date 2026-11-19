import {test,expect} from '@playwright/test';
import {activeTool,tryExample} from './task-helpers.js';

for(const tool of ['images','pdf'])test(`${tool} mobile primary action follows import and completed output`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(`/${tool}.html`);
 await expect(activeTool(page).locator('#'+tool+'-choose')).toBeVisible();await expect(activeTool(page).locator(`#${tool}-run`)).toBeHidden();
 await tryExample(page,tool);await expect(activeTool(page).locator(tool==='pdf'?'#pdf-result':'#images-results')).toBeVisible();
 await page.evaluate(()=>document.querySelector('main').scrollTop=0);if(tool==='images'){await expect(activeTool(page).locator('.images-preview-pair')).toBeInViewport();await expect(activeTool(page).locator('.workspace-view-result')).toBeHidden();}else{await expect(activeTool(page).locator('.workspace-view-result')).toBeVisible();await activeTool(page).locator('.workspace-view-result').click();}await expect(activeTool(page).locator('.workspace-action-area')).toHaveAttribute('data-action-state','result-visible');
 const result=activeTool(page).locator(tool==='pdf'?'#pdf-result':'#images-results');
 await expect.poll(()=>result.evaluate(node=>{const box=(node.querySelector('h2,h3')||node).getBoundingClientRect();return box.top>=0&&box.top<innerHeight-100;})).toBe(true);
 await expect(result.locator('button').first()).toBeEnabled();
});

for(const [route,selector]of [['regex','#regex-pattern'],['dates','#date-start'],['units','#unit-value'],['money','#money-input']])test(`${route} primary input remains readable at normal zoom`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(`/${route}.html`);expect(await activeTool(page).locator(selector).evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(18);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('invalid amount associates its error with the focused input and removes it on correction',async({page})=>{
 await page.goto('/money.html');await activeTool(page).locator('#money-input').fill('bad amount');await activeTool(page).locator('#money-run').click();await expect(activeTool(page).locator('#money-input')).toHaveAttribute('aria-invalid','true');await expect(activeTool(page).locator('#money-input')).toBeFocused();
 await expect(activeTool(page).locator('#money-input')).toHaveAttribute('aria-describedby',/money-input-error/);await expect(activeTool(page).locator('#money-input-error')).toBeVisible();
 await activeTool(page).locator('#money-input').fill('100');await expect(activeTool(page).locator('#money-input')).not.toHaveAttribute('aria-invalid');await expect(activeTool(page).locator('#money-input-error')).toHaveCount(0);await activeTool(page).locator('#money-run').click();await expect(activeTool(page).locator('#money-simplified')).toHaveText('壹佰元整');
});

for(const tool of ['units','draw','timer'])test(`${tool} reports an invalid submitted value beside its field`,async({page})=>{
 await page.goto(`/${tool}.html`);
 const field=tool==='units'?'unit-value':tool==='draw'?'draw-count':'timer-seconds';
 if(tool==='draw')await activeTool(page).locator('#draw-input').fill('Alice\nBob');
 await activeTool(page).locator('#'+field).fill(tool==='units'?'not a number':tool==='draw'?'3':'60');
 await activeTool(page).locator(tool==='units'?'#unit-run':tool==='draw'?'#draw-run':'#timer-start').click();
 await expect(activeTool(page).locator('#'+field)).toHaveAttribute('aria-invalid','true');await expect(activeTool(page).locator('#'+field+'-error')).toBeVisible();
});
