import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

const group=(page,id)=>page.locator(`nav>details[data-group-id="${id}"]`);

test('first use keeps every category collapsed in both the header and popup',async({page})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();
 await expect(page.locator('#tool-menu nav>details')).toHaveCount(4);
 await expect(page.locator('#tool-menu nav>details[open]')).toHaveCount(0);
 await page.goto('/popup.html');await expect(page.locator('nav>details[open]')).toHaveCount(0);
});

test('page and popup share category changes immediately and after reopening or reloading',async({page,context})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();
 const popup=await context.newPage();await popup.goto('/popup.html');
 await group(popup,'files').locator('summary').click();await expect(group(page,'files')).toHaveJSProperty('open',true);
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
 await page.locator('#menu-edit').click();await group(page,'daily').locator('summary').click();await page.locator('#menu-cancel').click();
 await expect(group(page,'network')).toHaveJSProperty('open',true);await expect(group(page,'daily')).toHaveJSProperty('open',false);
 await page.locator('#menu-edit').click();await page.locator('#menu-reset').click();await page.locator('#menu-save').click();
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
 await page.setViewportSize({width:360,height:900});await page.goto('/popup.html');
 // Close the categories which older versions opened by default, reproducing the reported empty space.
 for(const id of ['daily','files','developer','network'])if(await group(page,id).evaluate(node=>node.open))await group(page,id).locator('summary').click();
 const collapsed=await page.locator('body').evaluate(node=>node.getBoundingClientRect().height);expect(collapsed).toBeLessThan(550);
 const bottom=await page.locator('#popup-menu').evaluate(node=>node.getBoundingClientRect().bottom);expect(Math.abs(bottom-collapsed)).toBeLessThanOrEqual(1);
 for(const id of ['daily','files','developer','network'])await group(page,id).locator('summary').click();
 const expanded=await page.locator('body').evaluate(node=>node.getBoundingClientRect().height);expect(expanded).toBeGreaterThan(collapsed);expect(expanded).toBeLessThanOrEqual(560);
 await expect.poll(()=>page.locator('.tool-menu-list').evaluate(node=>node.scrollHeight-node.clientHeight)).toBeGreaterThan(0);
 await page.locator('.tool-menu-list').evaluate(node=>{node.scrollTop=node.scrollHeight;});await expect(page.locator('[data-tool-id="password"]')).toBeVisible();
 for(const id of ['network','developer','files','daily'])await group(page,id).locator('summary').click();
 await expect.poll(()=>page.locator('body').evaluate(node=>node.getBoundingClientRect().height)).toBe(collapsed);
});
