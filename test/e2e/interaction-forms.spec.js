import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';

async function aligned(page,selectors){
 const boxes=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));
 for(const box of boxes){expect(box).not.toBeNull();expect(Math.abs(box.y-boxes[0].y)).toBeLessThanOrEqual(1);}
}
async function inlineLabel(page,label,control){
 const [name,field]=await Promise.all([page.locator(label).boundingBox(),page.locator(control).boundingBox()]);
 expect(name).not.toBeNull();expect(field).not.toBeNull();expect(name.x+name.width).toBeLessThanOrEqual(field.x+1);
 expect(Math.abs(name.y+name.height/2-field.y-field.height/2)).toBeLessThanOrEqual(1);
}
async function singleVisibleError(page,field){
 const error=page.locator(field+'-error');await expect(error).toBeVisible();const message=await error.textContent();
 expect(await page.locator('#tool-status,.field-error').evaluateAll((nodes,text)=>nodes.filter(node=>{const box=node.getBoundingClientRect();return node.textContent===text&&box.width>1&&box.height>1&&getComputedStyle(node).visibility!=='hidden';}).length,message)).toBe(1);
 await expect(page.locator(field)).toHaveAttribute('aria-invalid','true');await expect(page.locator(field)).toHaveAttribute('aria-describedby',new RegExp(field.slice(1)+'-error'));
 await expect(page.locator('#tool-status')).toHaveAttribute('role','status');await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','error');await expect(page.locator('#tool-status')).toContainText(message);
}
for(const theme of ['light','dark'])test.describe(theme,()=>{
 test.beforeEach(async({page})=>{await page.addInitScript(theme=>{if(!localStorage.getItem('listools-language'))localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({version:1,theme}));},theme);});
 test('date defaults use today and leave birth date empty without marking pristine inputs edited',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));await page.goto('/dates.html');
  for(const id of ['date-start','date-end','date-base','date-reference','work-start','work-end'])await expect(page.locator('#'+id)).toHaveValue('2026-10-26');
  await expect(page.locator('#date-origin')).toHaveValue('');
  expect(await page.locator('#tool-menu a[data-target="money.html"]').first().evaluate(node=>{node.addEventListener('click',event=>event.preventDefault(),{once:true});node.click();return node.target;})).not.toBe('_blank');
  await page.locator('#difference-run').click();await expect(page.locator('#difference-copy')).toBeEnabled();const result=await page.locator('#difference-output').textContent();
  await page.locator('#date-today-start').click();await page.locator('#date-today-end').click();await expect(page.locator('#difference-output')).toHaveText(result);await expect(page.locator('#difference-copy')).toBeEnabled();
  await chooseTask(page,'dates','milestone');await page.locator('#milestone-run').click();await expect(page.locator('#date-origin')).toHaveAttribute('aria-invalid','true');
 });
 test('date inline validation preserves adjacent field and Today button positions',async({page})=>{
  await page.goto('/dates.html');await page.locator('#date-end').fill('2026-10-26');await page.locator('#date-start').fill('');await page.locator('#difference-run').click();
  await expect(page.locator('#date-start-error')).toBeVisible();
  await aligned(page,['label[for=date-start]','label[for=date-end]']);await aligned(page,['#date-start','#date-end']);await aligned(page,['#date-today-start','#date-today-end']);
  await singleVisibleError(page,'#date-start');await expect(page.locator('#date-start')).toBeFocused();
  await page.locator('#date-start').fill('2026-10-25');await page.locator('#difference-run').click();await expect(page.locator('#difference-output')).toContainText('1');await expect(page.locator('#date-start-error')).toHaveCount(0);await expect(page.locator('#date-start')).not.toHaveAttribute('aria-invalid','true');
 });
 test('draw inline validation preserves neighbor positions and clears on correction',async({page})=>{
  await page.goto('/draw.html');await page.locator('#draw-input').fill('Alice\nBob\nCharlie');await page.locator('#draw-count').fill('4');await page.locator('#draw-run').click();
  await singleVisibleError(page,'#draw-count');await aligned(page,['label[for=draw-mode]','label[for=draw-count]']);await aligned(page,['#draw-mode','#draw-count']);
  await page.locator('#draw-count').fill('2');await expect(page.locator('#draw-count-error')).toHaveCount(0);await page.locator('#draw-run').click();await expect(page.locator('#draw-copy')).toBeEnabled();
  await chooseTask(page,'draw','numbers');await page.locator('#draw-min').fill('200');await page.locator('#draw-max').fill('100');await page.locator('#draw-number-run').click();
  await singleVisibleError(page,'#draw-range');await aligned(page,['label[for=draw-min]','label[for=draw-max]','label[for=draw-number-count]']);await aligned(page,['#draw-min','#draw-max','#draw-number-count']);
  await page.locator('#draw-min').fill('1');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-copy')).toBeEnabled();await expect(page.locator('#draw-range-error')).toHaveCount(0);await expect(page.locator('#draw-range')).not.toHaveAttribute('aria-invalid','true');
 });
 test('short QR parameters keep their names beside the controls',async({page})=>{
  await page.goto('/qr.html');await page.locator('details:has(#qr-size)>summary').click();await inlineLabel(page,'label[for=qr-size]','#qr-size');await inlineLabel(page,'label[for=qr-level]','#qr-level');await aligned(page,['#qr-size','#qr-level']);
  await page.locator('#qr-generate').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','error');expect(await page.locator('#tool-status').evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(1);
 });
 test('short MD5 parameters keep their names beside the controls',async({page})=>{
  await page.goto('/convert.html#md5');
  await inlineLabel(page,'.md5-fields>label:has(#md5-mode)>span','#md5-mode');await inlineLabel(page,'#md5-representation-field>span','#md5-representation');await aligned(page,['#md5-mode','#md5-representation']);
 });
 test('short text parameters keep their names beside the controls',async({page})=>{
  await page.goto('/text.html');await inlineLabel(page,'label[for=text-lines]','#text-lines');await chooseTask(page,'text','case');await inlineLabel(page,'label[for=text-case]','#text-case');await chooseTask(page,'text','newline');await inlineLabel(page,'label[for=text-newline]','#text-newline');await chooseTask(page,'text','extract');await inlineLabel(page,'label[for=text-kind]','#text-kind');
 });
 test('short parameters wrap within the mobile viewport in a long language',async({page})=>{
  await page.setViewportSize({width:390,height:900});await page.addInitScript(()=>localStorage.setItem('listools-language','de'));
  for(const url of ['/qr.html','/convert.html#md5','/text.html']){await page.goto(url);await expect(page.locator('html')).toHaveAttribute('lang','de');if(url.includes('qr'))await page.locator('details:has(#qr-size)>summary').click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
   const selectors=url.includes('qr')?['#qr-size','#qr-level']:url.includes('convert')?['#md5-mode','#md5-representation']:['#text-lines'];
   for(const selector of selectors){const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);await expect(page.locator(selector)).toHaveAccessibleName(/.+/);}
  }
 });
});
