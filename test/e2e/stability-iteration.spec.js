import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {chooseTask} from './task-helpers.js';

test.beforeEach(async({page})=>{await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'}));});});
async function ready(page,path){await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');}
async function recordOpening(page,panel,button){
 await page.locator(panel).evaluate(node=>{window.openingFrames=[];node.addEventListener('beforetoggle',event=>{if(event.newState!=='open')return;let frame=0;function capture(){const rect=node.getBoundingClientRect();window.openingFrames.push({x:rect.x,y:rect.y,height:rect.height,opacity:Number(getComputedStyle(node).opacity),search:node.querySelector('input')?.checkVisibility()});if(++frame<8)requestAnimationFrame(capture);}requestAnimationFrame(capture);},{once:true});});
 await page.locator(button).click();await expect.poll(()=>page.evaluate(()=>window.openingFrames.length)).toBe(8);return page.evaluate(()=>window.openingFrames.filter(frame=>frame.opacity>0));
}
test('regex rules are searchable at the first visible frame',async({page})=>{
 await ready(page,'/regex.html');const frames=await recordOpening(page,'#regex-rules-panel','#regex-rules-open');expect(frames.every(frame=>frame.search)).toBe(true);expect(Math.max(...frames.map(f=>f.height))-Math.min(...frames.map(f=>f.height))).toBeLessThanOrEqual(1);await expect(page.locator('#regex-rule-search')).toBeFocused();
});
test('JSON edit menu is anchored before it becomes visible without motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page,'/');const frames=await recordOpening(page,'#json-edit-menu','#json-edit');const trigger=await page.locator('#json-edit').boundingBox();expect(frames.every(frame=>Math.abs(frame.x-trigger.x)<=1)).toBe(true);expect(Math.max(...frames.map(f=>f.y))-Math.min(...frames.map(f=>f.y))).toBeLessThanOrEqual(1);await page.keyboard.press('Escape');await expect(page.locator('#json-edit')).toBeFocused();
});
test('unchanged date calculations preserve the selected value and result nodes',async({page})=>{
 await ready(page,'/dates.html#shift');await page.locator('#date-base').fill('2026-10-28');await page.locator('#shift-run').click();await expect(page.locator('#shift-output .date-primary-value')).toHaveText('2026-11-04');
 await page.locator('#shift-output .date-primary-value').evaluate(node=>{window.savedDateNode=node;const range=document.createRange();range.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(range);});
 await page.locator('#shift-run').click();expect(await page.evaluate(()=>getSelection().toString())).toBe('2026-11-04');expect(await page.locator('#shift-output .date-primary-value').evaluate(node=>node===window.savedDateNode)).toBe(true);
 await page.locator('#date-amount').fill('8');await page.locator('#shift-run').click();await expect(page.locator('#shift-output .date-primary-value')).toHaveText('2026-11-05');
});
test('date success formats have valid description lists in all tasks',async({page})=>{
 await ready(page,'/dates.html');await page.emulateMedia({reducedMotion:'reduce'});
 for(const id of ['difference','shift','milestone','workdays']){await chooseTask(page,'dates',id);if(id==='milestone')await page.locator('#date-origin').fill('2000-01-01');await page.locator('#'+id+'-run').click();if(['difference','workdays'].includes(id))await page.locator('#'+id+'-output .date-interval-times>summary').click();const results=await new AxeBuilder({page}).include('#'+id+'-result').withRules(['definition-list']).analyze();expect(results.violations.map(v=>v.id)).toEqual([]);}
});
test('date timezone has no dangling description and interval labels are specific',async({page})=>{
 await ready(page,'/dates.html');const descriptions=await page.locator('#date-zone').evaluate(node=>{const value=node.closest('.choices').getAttribute('aria-describedby');return value?value.split(/\s+/).filter(id=>!document.getElementById(id)):[];});expect(descriptions).toEqual([]);await expect(page.locator('label[for=date-end]')).toHaveText('结束日期');await chooseTask(page,'dates','milestone');await expect(page.locator('label[for=date-reference]')).toHaveText('参考日期');
});
test('mobile timestamp settings have full-width time and timezone controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page,'/dates.html');const time=await page.locator('#date-time').boundingBox(),zone=await page.locator('#date-zone').locator('..').locator('..').boundingBox();expect(zone.y).toBeGreaterThanOrEqual(time.y+time.height);expect(time.width).toBeGreaterThan(280);
});
test('desktop date forms leave enough room to read milliseconds in the time input',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await ready(page,'/dates.html#shift');const time=await page.locator('#date-time').boundingBox();expect(time.width).toBeGreaterThanOrEqual(220);
});
