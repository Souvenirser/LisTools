import {startMenuSorting} from './menu-helpers.js';
import {test,expect} from '@playwright/test';

test('menu marks only the most specific visible tool as current',async({page})=>{
 for(const [path,target,query,searched]of [
  ['/convert.html#md5','convert.html#md5','MD5','convert.html#md5'],
  ['/convert.html#hex','convert.html','hex','convert.html#hex'],
  ['/convert.html','convert.html','base64','convert.html#base64'],
  ['/convert.html#unknown','convert.html','base64','convert.html#base64'],
  ['/dates.html#workdays','dates.html','workdays','dates.html#workdays'],
  ['/diff.html','diff.html','diff','diff.html']
 ]){
  await page.goto(path);await page.locator('button.brand').click();const current=page.locator('#tool-menu a[aria-current="page"]');await expect(current).toHaveCount(1);await expect(current).toHaveAttribute('data-target',target);
  await page.locator('#tool-menu-search').fill(query);await expect(current).toHaveCount(1);await expect(current).toHaveAttribute('data-target',searched);await page.keyboard.press('Escape');
 }
});

test('menu sorting saves groups and tools across popup and pages, while cancelling leaves storage unchanged',async({page,context})=>{
 await page.goto('/popup.html');await startMenuSorting(page);
 await page.locator('[data-group-id="network"]>summary .tool-menu-sort-handle').focus();await page.keyboard.press('Alt+ArrowUp');
 await page.locator('[data-group-id="daily"]>summary').click();
 const timer=page.locator('[data-tool-id="timer"] .tool-menu-sort-handle');await timer.focus();await page.keyboard.press('Alt+ArrowUp');
 await page.locator('#menu-save').click();
 await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');
 await page.reload();await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');
 const other=await context.newPage();await other.goto('/qr.html');await other.locator('button.brand').click();await expect(other.locator('#tool-menu nav>details').nth(2)).toHaveAttribute('data-group-id','network');
 await startMenuSorting(page);await page.locator('#menu-reset').click();await page.locator('#menu-cancel').click();
 await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');
 await startMenuSorting(page);await page.locator('#menu-reset').click();await page.locator('#menu-save').click();
 await expect(other.locator('#tool-menu nav>details').nth(2)).toHaveAttribute('data-group-id','developer');
});

test('real drag reorders categories and tools without navigating or changing category membership',async({page})=>{
 await page.goto('/popup.html');await startMenuSorting(page);
 const daily=page.locator('[data-group-id="daily"]');
 await page.locator('[data-group-id="network"]>summary .tool-menu-sort-handle').dragTo(daily.locator('summary .tool-menu-sort-handle'));
 await expect(page.locator('nav>details').first()).toHaveAttribute('data-group-id','network');
 await daily.locator('summary').click();
 await page.locator('[data-tool-id="timer"] .tool-menu-sort-handle').dragTo(page.locator('[data-tool-id="draw"] .tool-menu-sort-handle'));
 await expect(daily.locator('[data-tool-id]').nth(4)).toHaveAttribute('data-tool-id','timer');
 await page.locator('[data-tool-id="timer"] .tool-menu-name').click();await expect(page).toHaveURL(/popup\.html$/);
 await page.locator('#menu-save').click();await expect(page.locator('nav a[data-tool-id="timer"]')).toHaveCount(1);
 await expect(page.locator('[data-group-id="daily"] a').nth(4)).toHaveAttribute('data-tool-id','timer');
});

test('denied preference storage reports unsaved order and keeps it until page closes',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw Error('denied');};});
 await page.goto('/popup.html');await startMenuSorting(page);
 await page.locator('[data-group-id="network"]>summary .tool-menu-sort-handle').focus();await page.keyboard.press('Alt+ArrowUp');await page.locator('#menu-save').click();
 await expect(page.locator('#menu-sort-status')).toContainText('could not');
 await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');
});

test('dragging an item over another category does not move it across groups',async({page})=>{
 await page.goto('/popup.html');await startMenuSorting(page);for(const id of ['daily','files'])await page.locator(`[data-group-id="${id}"]>summary`).click();const source=page.locator('[data-tool-id="timer"] .tool-menu-sort-handle'),target=page.locator('[data-tool-id="qr"] .tool-menu-sort-handle');await target.scrollIntoViewIfNeeded();await source.dragTo(target);await page.locator('#menu-save').click();await expect(page.locator('[data-group-id="daily"] [data-tool-id="timer"]')).toHaveCount(1);await expect(page.locator('[data-group-id="files"] [data-tool-id="timer"]')).toHaveCount(0);
});

test('touch long press reorders a category with the same saved preference',async({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Touch dispatch uses Chromium CDP; other engines retain mouse and keyboard coverage.');
 await page.goto('/popup.html');await startMenuSorting(page);const from=await page.locator('[data-group-id="network"]>summary .tool-menu-sort-handle').boundingBox(),to=await page.locator('[data-group-id="developer"]>summary .tool-menu-sort-handle').boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x+18,y:from.y+22,id:0}]});await page.waitForTimeout(240);
 for(let step=1;step<=12;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+18,y:from.y+22+(to.y-from.y-10)*step/12,id:0}]});await page.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');await page.locator('#menu-save').click();await page.reload();await expect(page.locator('nav>details').nth(2)).toHaveAttribute('data-group-id','network');
});

test('dragging near the menu edge scrolls a tall category',async({page})=>{
 await page.setViewportSize({width:360,height:560});await page.goto('/popup.html');await startMenuSorting(page);await page.locator('[data-group-id="daily"]>summary').click();
 const handle=await page.locator('[data-tool-id="calculator"] .tool-menu-sort-handle').boundingBox(),list=page.locator('.tool-menu-scroll'),bounds=await list.boundingBox();
 await page.mouse.move(handle.x+20,handle.y+20);await page.mouse.down();await page.mouse.move(handle.x+20,handle.y+30,{steps:4});await page.mouse.move(bounds.x+30,bounds.y+bounds.height-6,{steps:12});
 // Keep moving at the edge beyond Sortable's dragover throttle window.
 await page.waitForTimeout(75);await page.mouse.move(bounds.x+31,bounds.y+bounds.height-8);
 await expect.poll(()=>list.evaluate(node=>node.scrollTop)).toBeGreaterThan(20);await page.mouse.up();await page.locator('#menu-cancel').click();
});
