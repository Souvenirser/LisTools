import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>page.addInitScript(()=>{
 localStorage.setItem('listools-language','zh-Hans');
 localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'}));
}));
async function ready(page,path){await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');}

test('editor focus belongs to the frame, not the shorter content layer',async({page})=>{
 await ready(page,'/regex.html');const content=page.locator('#regex-source .cm-content');await content.click();
 expect(await content.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
 expect(await page.locator('#regex-source .cm-editor').evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
});
test('1200px desktop retains text, below it the menu retains text',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await ready(page,'/timer.html');
 expect((await page.locator('#workbench-navigation').boundingBox()).width).toBe(256);
 await expect(page.locator('#tool-menu .tool-menu-name').first()).toBeVisible();
 await page.setViewportSize({width:1199,height:768});await expect(page.locator('#workbench-navigation')).toBeHidden();await page.locator('#global-search-open').click();await expect(page.locator('#tool-menu .tool-menu-name').first()).toBeVisible();
});
test('clock and both conversions remain in normal flow',async({page})=>{
 await ready(page,'/timestamp.html');await page.locator('#timestamp-now').click();await page.locator('#datetime-now').click();
 for(const open of[true,false,true]){
  await page.locator('#clock-details').evaluate((el,value)=>el.open=value,open);
  await expect.poll(async()=>page.evaluate(()=>{const clock=document.querySelector('.clock-overview').getBoundingClientRect(),next=document.querySelector('.timestamp-workspace').getBoundingClientRect();return next.top-clock.bottom;})).toBeGreaterThanOrEqual(0);
  const overflow=await page.locator('.clock-overview').evaluate(el=>[...el.querySelectorAll('button,summary,.clock-panel')].filter(n=>n.checkVisibility()).some(n=>n.getBoundingClientRect().bottom>el.getBoundingClientRect().bottom+1));expect(overflow).toBe(false);
 }
});
for(const id of['dates','cron'])test(`${id} task buttons are vertically centered`,async({page})=>{
 await ready(page,`/${id}.html`);const gaps=await page.locator('.task-guide').evaluate(el=>{const box=el.getBoundingClientRect(),items=el.querySelector('.task-choices').getBoundingClientRect(),style=getComputedStyle(el);return [items.top-box.top-parseFloat(style.borderTopWidth),box.bottom-items.bottom-parseFloat(style.borderBottomWidth)];});expect(Math.abs(gaps[0]-gaps[1])).toBeLessThanOrEqual(1);expect(gaps[0]).toBeGreaterThanOrEqual(8);
});
test('MD5 expanded formats do not stretch the input or its footer',async({page})=>{
 await ready(page,'/convert.html#md5');await page.locator('#md5-run').click();await expect(page.locator('#md5-other-formats')).toBeVisible();
 const panel=page.locator('#convert-source').locator('..'),before=await panel.boundingBox();await page.locator('#md5-other-formats>summary').click();
 expect(Math.abs((await panel.boundingBox()).height-before.height)).toBeLessThanOrEqual(1);
 const result=page.locator('#md5-single');expect(await result.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
});
test('standard calculator uses a side information rail and fits short desktop',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await ready(page,'/calculator.html');await expect(page.locator('#calculate')).toBeInViewport({ratio:1});
 const work=await page.locator('.calculator-workbench').boundingBox(),title=await page.locator('.tool-heading').boundingBox();expect(title.x).toBeGreaterThan(work.x+work.width);expect(Math.abs(title.y-work.y)).toBeLessThanOrEqual(1);
});
test('language choices and close stay inside a short settings dialog',async({page})=>{
 await page.setViewportSize({width:390,height:400});await ready(page,'/dates.html');await page.locator('#settings-open').click();await page.locator('#settings-language .choices').click();
 const dropdown=page.locator('#settings-language .choices__list--dropdown');await expect(dropdown).toBeVisible();const box=await dropdown.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(400);await expect(page.locator('#settings-close')).toBeInViewport({ratio:1});
});
test('conversion groups remember disclosure and search only temporarily expands',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await ready(page,'/convert.html');const groups=page.locator('details.convert-catalog-group');expect(await groups.count()).toBe(8);expect(await groups.evaluateAll(list=>list.every(el=>el.open))).toBe(true);
 const first=groups.first();await first.locator('summary').click();await expect(first).not.toHaveAttribute('open','');await page.reload();await expect(groups.first()).not.toHaveAttribute('open','');await page.locator('#convert-search').fill('Base64');await expect(groups.first()).toHaveAttribute('open','');await page.locator('#convert-search').fill('');await expect(groups.first()).not.toHaveAttribute('open','');
 expect(await groups.first().locator('summary').evaluate(el=>getComputedStyle(el).position)).toBe('static');
});

test('short scientific calculator keeps multi-argument guidance visible',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await ready(page,'/calculator.html');
 await expect(page.locator('.calculator-result-value>label')).toBeHidden();
 await page.locator('#calc-mode-scientific').click();await page.locator('[data-key=logBase]').click();
 await expect(page.locator('#argument-hint')).toBeVisible();await expect(page.locator('#argument-hint')).toContainText('log(8, 2)');
});

test('open language choices follow the scrolling settings container',async({page})=>{
 await page.setViewportSize({width:390,height:300});await ready(page,'/dates.html');await page.locator('#settings-open').click();await page.locator('#settings-language .choices').click();
 const dropdown=page.locator('#settings-language .choices__list--dropdown'),before=await dropdown.boundingBox();
 await page.locator('#workbench-settings').evaluate(el=>{el.scrollTop=el.scrollTop>0?0:20;});
 await expect.poll(async()=>{const menu=await dropdown.boundingBox(),control=await page.locator('#settings-language .choices').boundingBox();return Math.min(Math.abs(menu.y-control.y-control.height),Math.abs(menu.y+menu.height-control.y));}).toBeLessThanOrEqual(1);
 const after=await dropdown.boundingBox();expect(after.y).not.toBe(before.y);expect(after.y).toBeGreaterThanOrEqual(0);expect(after.y+after.height).toBeLessThanOrEqual(300);
});
