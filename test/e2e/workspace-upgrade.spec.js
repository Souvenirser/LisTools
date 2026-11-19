import {activeTool} from './task-helpers.js';
import {test,expect} from '@playwright/test';

const sample=JSON.stringify({rows:Array.from({length:250},(_,id)=>({id,name:`row-${id}`,value:id}))},null,2);
for(const [width,height,min] of [[1440,900,440],[1366,768,320]])test(`comparison gives long inputs and results readable height at ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/diff.html');
 await activeTool(page).locator('#left-source .cm-content').fill(sample);await activeTool(page).locator('#right-source .cm-content').fill(sample.replace('row-8','changed-8'));
 for(const id of ['left-source','right-source'])expect((await activeTool(page).locator(`#${id} .cm-scroller`).boundingBox()).height).toBeGreaterThanOrEqual(min);
 await expect(activeTool(page).locator('#only-diff')).not.toBeChecked();await expect(activeTool(page).locator('#left-source .cm-lineNumbers')).toBeVisible();
 await activeTool(page).locator('#compare').click();await expect(activeTool(page).locator('.cm-mergeView')).toBeVisible();
 expect((await activeTool(page).locator('.cm-mergeView').boundingBox()).height).toBeGreaterThanOrEqual(min);
 await expect(activeTool(page).locator('.cm-collapsedLines')).toHaveCount(0);
 await activeTool(page).locator('.cm-merge-b .cm-content').focus();await page.keyboard.press(process.platform==='darwin'?'Meta+ArrowDown':'Control+End');
 await expect(activeTool(page).locator('.cm-merge-b .cm-line').last()).toContainText('}');
 await activeTool(page).locator('#only-diff').check();await expect(activeTool(page).locator('.cm-collapsedLines').first()).toBeVisible();
});

test('narrow comparison stacks complete inputs without page overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/diff.html');
 const left=await activeTool(page).locator('#left-source .cm-scroller').boundingBox(),right=await activeTool(page).locator('#right-source .cm-scroller').boundingBox();
 expect(left.height).toBeGreaterThanOrEqual(240);expect(right.height).toBeGreaterThanOrEqual(240);expect(right.y).toBeGreaterThan(left.y+left.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

for(const [route,editor,scroll]of [['diff','#left-source .cm-content','#left-source .cm-scroller'],['convert','#convert-source .cm-content','#convert-source .cm-scroller'],['regex','#regex-source .cm-content','#regex-source .cm-scroller']])test(`${route} keeps a bounded internal scroll viewport after a long document settles`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto(`/${route}.html`);
 await activeTool(page).locator(editor).fill(Array.from({length:500},(_,i)=>`line-${i}`).join('\n'));
 await activeTool(page).locator(scroll).evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const metrics=await activeTool(page).locator(scroll).evaluate(node=>{node.scrollTop=node.scrollHeight;return {height:node.clientHeight,scroll:node.scrollHeight,top:node.scrollTop};});
 expect(metrics.height).toBeLessThan(900);expect(metrics.scroll).toBeGreaterThan(metrics.height);expect(metrics.top).toBeGreaterThan(0);
});

test('clearing modified comparison inputs restores visible status and the initial layout',async({page})=>{
 await page.goto('/diff.html');await activeTool(page).locator('#left-source .cm-content').fill('{"x":1}');await activeTool(page).locator('#right-source .cm-content').fill('{"x":2}');await activeTool(page).locator('#compare').click();await expect(activeTool(page).locator('.cm-mergeView')).toBeVisible();await activeTool(page).locator('#diff-edit-inputs').click();await expect(activeTool(page).locator('body')).toHaveClass(/editing-comparison/);await activeTool(page).locator('#inputs').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await activeTool(page).locator('#left-source .cm-content').fill('{"x":3}');await activeTool(page).locator('#clear').click();await expect(activeTool(page).locator('#diff-total')).toBeVisible();await expect(activeTool(page).locator('body')).not.toHaveClass(/editing-comparison/);
});

test('narrow comparison results stack readable editors and can reach the end of either document',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/diff.html');await activeTool(page).locator('#left-source .cm-content').fill(sample);await activeTool(page).locator('#right-source .cm-content').fill(sample.replace('row-8','changed-8'));await activeTool(page).locator('#compare').click();await expect(activeTool(page).locator('.cm-mergeViewEditor')).toHaveCount(2);
 const panels=activeTool(page).locator('.cm-mergeViewEditor'),left=await panels.nth(0).boundingBox(),right=await panels.nth(1).boundingBox();expect(left.height).toBeGreaterThanOrEqual(240);expect(right.y).toBeGreaterThanOrEqual(left.y+left.height);
 for(const panel of await panels.all()){await panel.locator('.cm-content').focus();await page.keyboard.press(process.platform==='darwin'?'Meta+ArrowDown':'Control+End');await expect.poll(()=>panel.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);}
 await page.setViewportSize({width:1440,height:900});await expect.poll(()=>activeTool(page).locator('.cm-mergeView').evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
