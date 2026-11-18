import {startMenuSorting} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

const group=(page,id)=>page.locator(`nav>details[data-group-id="${id}"]`);
async function setGroup(page,id,open){const node=group(page,id);if(await node.evaluate(el=>el.open)!==open)await node.locator('summary').click();}

test('desktop toolbar, brand, and keyboard open the same dropdown and return focus',async({page})=>{
 await page.setViewportSize({width:1360,height:960});
 await page.goto('/qr.html');
 const menu=page.locator('#tool-menu'),brand=page.locator('button.brand'),toolbar=page.locator('#global-search-open');
 await expect(menu).toBeHidden();
 await toolbar.click();await expect(menu).toBeVisible();await expect(page.locator('#tool-menu-search')).toBeFocused();
 await expect(menu.locator('nav>details').first()).toHaveAttribute('data-group-id','developer');
 await expect(menu.locator('nav>details[open]')).toHaveCount(1);await expect(group(page,'daily')).toHaveJSProperty('open',false);
 await toolbar.click();await expect(menu).toBeHidden();await toolbar.click();await expect(page.locator('#tool-menu-search')).toBeFocused();
 await page.keyboard.press('Escape');await expect(toolbar).toBeFocused();await expect(menu).toBeHidden();
 await brand.click();await expect(menu).toBeVisible();
 await page.keyboard.press('Escape');await expect(brand).toBeFocused();
 await page.keyboard.press('Control+k');await expect(menu).toBeVisible();
 await page.keyboard.press('Escape');await expect(brand).toBeFocused();
 await page.setViewportSize({width:320,height:650});await page.goto('/popup.html');
 await expect(group(page,'developer')).toHaveJSProperty('open',true);
 expect(await page.locator('body').evaluate(node=>node.getBoundingClientRect().width)).toBeLessThanOrEqual(320);
});

test('page and popup share category changes immediately and after reopening or reloading',async({page,context})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();
 const popup=await context.newPage();await popup.goto('/popup.html');
 await group(popup,'files').locator('summary').click();await expect(group(page,'files')).toHaveJSProperty('open',true);
 await group(page,'developer').locator('summary').click();await expect(group(popup,'developer')).toHaveJSProperty('open',false);
 await group(page,'developer').locator('summary').click();await expect(group(popup,'developer')).toHaveJSProperty('open',true);
 await group(popup,'files').locator('summary').click();await expect(group(page,'files')).toHaveJSProperty('open',false);
 await page.keyboard.press('Escape');await page.locator('button.brand').click();
 await expect(group(page,'developer')).toHaveJSProperty('open',true);await expect(group(page,'files')).toHaveJSProperty('open',false);
 await page.reload();await page.locator('button.brand').click();await expect(group(page,'developer')).toHaveJSProperty('open',true);
 await popup.reload();await expect(group(popup,'developer')).toHaveJSProperty('open',true);await expect(group(popup,'files')).toHaveJSProperty('open',false);
 await group(popup,'developer').locator('summary').click();await expect(group(page,'developer')).toHaveJSProperty('open',false);
 await page.goto('/pdf.html');await page.locator('button.brand').click();await expect(page.locator('#tool-menu nav>details[open]')).toHaveCount(0);
});

test('search, language and sorting preserve the normal browsing expansion preference',async({page})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();await group(page,'network').locator('summary').click();
 await page.locator('#tool-menu-search').fill('pdf');await page.locator('#tool-menu-search').clear();await expect(group(page,'network')).toHaveJSProperty('open',true);
 await page.keyboard.press('Escape');await selectLanguage(page,'de');await page.locator('button.brand').click();await expect(group(page,'network')).toHaveJSProperty('open',true);
 await startMenuSorting(page);await group(page,'daily').locator('summary').click();await page.locator('#menu-cancel').click();
 await expect(group(page,'network')).toHaveJSProperty('open',true);await expect(group(page,'daily')).toHaveJSProperty('open',false);
 await startMenuSorting(page);await page.locator('#menu-reset').click();await page.locator('#menu-save').click();
 await expect(group(page,'network')).toHaveJSProperty('open',true);await page.reload();await page.locator('button.brand').click();await expect(group(page,'network')).toHaveJSProperty('open',true);
});

test('remote category changes do not clear an active tool search',async({page,context})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('pdf');
 const popup=await context.newPage();await popup.goto('/popup.html');await group(popup,'network').locator('summary').click();
 await expect(page.locator('#tool-menu-search')).toHaveValue('pdf');await expect(page.locator('#tool-menu a[data-target="pdf.html"]')).toBeVisible();
 await page.locator('#tool-menu-search').clear();await expect(group(page,'network')).toHaveJSProperty('open',true);
});

test('unavailable storage still preserves expansion when reopening the current menu',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('denied');};Storage.prototype.setItem=function(){throw Error('denied');};});
 await page.goto('/qr.html');await page.locator('button.brand').click();await group(page,'network').locator('summary').click();
 await page.keyboard.press('Escape');await page.locator('button.brand').click();await expect(group(page,'network')).toHaveJSProperty('open',true);
});

test('popup height shrinks to its content and expanded lists scroll within the limit',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:360,height:900});await page.goto('/popup.html');
 for(const id of ['daily','files','developer','network'])await setGroup(page,id,false);
 const height=()=>page.locator('body').evaluate(node=>node.getBoundingClientRect().height);
 await expect.poll(height).toBeLessThan(550);const collapsed=await height();
 await expect.poll(()=>page.locator('#popup-menu').evaluate(node=>Math.abs(node.getBoundingClientRect().bottom-document.body.getBoundingClientRect().bottom))).toBeLessThanOrEqual(1);
 for(const id of ['daily','files','developer','network'])await setGroup(page,id,true);
 await page.locator('#popup-menu').evaluate(async menu=>{await Promise.allSettled(menu.getAnimations({subtree:true}).map(animation=>animation.finished));});
 await expect.poll(height).toBeGreaterThan(collapsed);await expect.poll(height).toBeLessThanOrEqual(560);
 await expect.poll(()=>page.locator('.tool-menu-scroll').evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
 await page.locator('.tool-menu-scroll').evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(page.locator('[data-tool-id="password"]')).toBeVisible();
 for(const id of ['network','developer','files','daily'])await setGroup(page,id,false);
 await expect.poll(async()=>Math.abs(await height()-collapsed)).toBeLessThanOrEqual(1);
});

test('a constrained popup keeps its footer visible and can grow again after collapsing',async({page})=>{
 await page.setViewportSize({width:360,height:440});await page.goto('/popup.html');
 const footer=page.locator('.tool-menu-footer'),list=page.locator('.tool-menu-scroll');
 const footerFits=()=>footer.evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight+1);
 for(const id of ['daily','files','developer','network'])await setGroup(page,id,true);
 await page.locator('#popup-menu').evaluate(async menu=>{await Promise.allSettled(menu.getAnimations({subtree:true}).map(animation=>animation.finished));});
 await expect.poll(footerFits).toBe(true);await expect(page.locator('#app-version')).toBeVisible();
 await expect(footer.locator('.feedback-link')).toBeInViewport();
 await list.evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(page.locator('[data-tool-id="password"]')).toBeInViewport();
 await startMenuSorting(page);await expect.poll(footerFits).toBe(true);
 await page.locator('#menu-cancel').click();await expect.poll(footerFits).toBe(true);
 for(const id of ['network','developer','files','daily'])await setGroup(page,id,false);
 await page.locator('#popup-menu').evaluate(async menu=>{await Promise.allSettled(menu.getAnimations({subtree:true}).map(animation=>animation.finished));});
 const collapsed=await page.locator('body').evaluate(node=>node.getBoundingClientRect().height);
 await page.setViewportSize({width:360,height:900});
 await group(page,'developer').locator('summary').click();
 await expect.poll(()=>page.locator('body').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThan(collapsed);
 await expect.poll(footerFits).toBe(true);
 await page.setViewportSize({width:360,height:400});await expect.poll(footerFits).toBe(true);
 await page.setViewportSize({width:360,height:900});
 await expect.poll(()=>page.locator('body').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThan(collapsed);
 await expect.poll(footerFits).toBe(true);
});

test('IME composition defers results and Enter opens the committed split and decode routes',async({page})=>{
 await page.goto('/qr.html');
 const search=page.locator('#tool-menu-search');
 const open=async()=>{await page.locator('#global-search-open').click();await expect(search).toBeFocused();};
 await open();await search.dispatchEvent('compositionstart');await search.fill('PDF拆分');
 await search.dispatchEvent('keydown',{key:'Enter',isComposing:true});
 await expect(page).toHaveURL(/qr.html$/);
 await expect(page.locator('#tool-menu nav>details')).toHaveCount(4);
 await search.dispatchEvent('compositionend');
 await expect(page.locator('#tool-menu nav>a').first()).toHaveAttribute('data-target','pdf.html#split');
 await search.press('Enter');await expect(page).toHaveURL(/pdf.html#split$/);
 const tool=page.frameLocator('iframe[data-workspace-active]');
 await expect(tool.locator('#pdf-mode')).toHaveValue('split');
 await open();await search.fill('解碼 Base64');await search.press('Enter');await expect(page).toHaveURL(/convert.html#base64-decode$/);
 await expect(tool.locator('#option-direction')).toHaveValue('decode');
});
