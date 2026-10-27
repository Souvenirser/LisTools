import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

async function fullMenu(page,language='zh-Hans'){
 await page.addInitScript(language=>{localStorage.setItem('listools-language',language);localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark',recent:['timer','draw','money','units','dates'],favorites:['json','diff','qr','text','pdf']}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));},language);
 await page.goto('/timer.html');await expect(page.locator('#tool-menu.is-sidebar')).toBeVisible();
}
for(const {width,height,font,language} of [
 {width:1440,height:900,font:100,language:'zh-Hans'},
 {width:1440,height:600,font:125,language:'zh-Hans'},
 {width:1440,height:480,font:100,language:'en'},
 {width:1920,height:1080,font:200,language:'de'},
 {width:1366,height:600,font:100,language:'en'}
])test(`expanded sidebar scrolls independently at ${width}x${height}, ${font}% text`,async({page})=>{
 await page.setViewportSize({width,height});await fullMenu(page,language);
 if(font!==100)await page.addStyleTag({content:`html{font-size:${font}%!important}`});
 const aside=page.locator('#workbench-navigation'),scroll=page.locator('#tool-menu .tool-menu-scroll');
 await expect.poll(()=>aside.evaluate(n=>n.getBoundingClientRect().bottom),{timeout:1500}).toBeLessThanOrEqual(height+1);
 expect(await scroll.evaluate(n=>n.scrollHeight-n.clientHeight)).toBeGreaterThan(100);
 const mainTop=await page.locator('main').evaluate(n=>n.scrollTop);await scroll.hover();await page.mouse.wheel(0,20000);
 await expect.poll(()=>scroll.evaluate(n=>n.scrollTop)).toBeGreaterThan(100);
 await expect(page.locator('#tool-menu nav a[data-tool-id="password"]')).toBeInViewport();
 expect(await page.locator('main').evaluate(n=>n.scrollTop)).toBe(mainTop);
 if(width>=1440)await expect(page.locator('.tool-menu-footer')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight)).toBeLessThanOrEqual(1);
});

test('settings remain scrollable at 200% text in a short mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:480});await page.goto('/money.html');await selectLanguage(page,'de');
 await page.addStyleTag({content:'html{font-size:200%!important}'});await page.locator('#settings-open').click();const dialog=page.locator('#workbench-settings');
 expect(await dialog.evaluate(n=>n.scrollHeight-n.clientHeight)).toBeGreaterThan(0);
 await dialog.hover();await page.mouse.wheel(0,1500);await expect(page.locator('#settings-sort')).toBeInViewport({timeout:1500});
 await page.locator('#settings-close').scrollIntoViewIfNeeded();await page.locator('#settings-close').click();await expect(dialog).not.toBeVisible();
});

test('resizing within the desktop layout preserves an active menu search',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fullMenu(page);await page.locator('#global-search-open').click();await page.locator('#tool-menu-search').fill('pdf');
 await page.setViewportSize({width:1540,height:900});await expect(page.locator('#tool-menu-search')).toBeFocused({timeout:1500});await expect(page.locator('#tool-menu-search')).toHaveValue('pdf');await expect(page.locator('#tool-menu nav a[data-target="pdf.html"]')).toBeVisible();
});

test('a storage write failure does not undo theme or favorites in the current page',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.addInitScript(()=>{localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily']));const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='listools-preferences-v1')throw Error('quota exceeded');return write.call(this,key,value);};});
 await page.goto('/money.html');await page.locator('#settings-open').click();await page.locator('#theme-preference').selectOption('dark');await page.locator('#settings-close').click();await page.locator('#tool-menu nav [data-favorite="money"]').click();
 await expect(page.locator('#tool-menu nav [data-favorite="money"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('.tool-menu-saved a[data-tool-id="money"]')).toHaveCount(1);
});

test('Escape closes an open language dropdown before closing settings',async({page})=>{
 await page.goto('/money.html');await page.locator('#settings-open').click();const dialog=page.locator('#workbench-settings'),choice=dialog.locator('.choices');await choice.click();await expect(choice).toHaveAttribute('aria-expanded','true');await choice.locator('input[type=search]').press('Escape');await page.evaluate(()=>new Promise(requestAnimationFrame));
 await expect(dialog).toBeVisible({timeout:1500});await expect(choice).toHaveAttribute('aria-expanded','false');await expect(choice).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(page.locator('#settings-open')).toBeFocused();
});

test('an active sidebar search stays visible when entering compact desktop layout',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fullMenu(page);await page.locator('#global-search-open').click();await page.locator('#tool-menu-search').fill('pdf');await page.setViewportSize({width:1366,height:900});
 await expect(page.locator('#tool-menu-search')).toBeVisible({timeout:1500});await expect(page.locator('#tool-menu-search')).toBeFocused();await expect(page.locator('#tool-menu-search')).toHaveValue('pdf');
});
