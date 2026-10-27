import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

for(const [route,editor,scroll]of [['index','#source .cm-content','#source'],['diff','#left-source .cm-content','#left-source .cm-scroller'],['convert','#convert-source .cm-content','#convert-source .cm-scroller'],['regex','#regex-source .cm-content','#regex-source .cm-scroller'],['text','#text-input','#text-input']])test(`focus mode preserves the ${route} editor and increases its reading space`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto(`/${route}.html`);
 await page.locator(editor).fill('keep this content');await page.evaluate(selector=>{window.originalEditor=document.querySelector(selector);},editor);
 await page.locator('#workspace-focus').click();await expect(page.locator('body')).toHaveClass(/workspace-focused/);
 await expect.poll(async()=>(await page.locator(scroll).boundingBox()).height).toBeGreaterThanOrEqual(630);
 expect(await page.evaluate(selector=>window.originalEditor===document.querySelector(selector),editor)).toBe(true);

 await page.locator('#workspace-focus').focus();await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/workspace-focused/);
 await selectLanguage(page,'de');
 if(route==='text')await expect(page.locator(editor)).toHaveValue('keep this content');else await expect(page.locator(editor)).toContainText('keep this content');
});

test('editor search consumes Escape before focus mode exits, and file MD5 cannot enter focus',async({page})=>{
 await page.goto('/convert.html#base64');await page.locator('#workspace-focus').click();await page.locator('#convert-source .cm-content').focus();await page.keyboard.press('ControlOrMeta+f');await expect(page.locator('#convert-source .cm-search')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('body')).toHaveClass(/workspace-focused/);await expect(page.locator('#convert-source .cm-search')).toHaveCount(0);
 await page.goto('/convert.html#md5');await page.locator('#md5-mode').selectOption('files');await expect(page.locator('#workspace-focus')).toBeHidden();
});

test('focus mode preserves undo and a mid-document scroll position',async({page})=>{
 await page.goto('/convert.html#base64');await page.locator('#convert-auto').uncheck();const input=page.locator('#convert-source .cm-content');await input.fill('');await input.pressSequentially('keep');await page.locator('#workspace-focus').click();await page.locator('#workspace-focus').click();await input.focus();await page.keyboard.press('ControlOrMeta+z');await expect(input).toBeEmpty();
 await input.fill(Array.from({length:500},(_,i)=>`line-${i}`).join('\n'));const scroll=page.locator('#convert-source .cm-scroller');await scroll.evaluate(node=>node.scrollTop=1000);await page.locator('#workspace-focus').click();await expect.poll(()=>scroll.evaluate(node=>node.scrollTop)).toBeGreaterThan(900);await page.locator('#workspace-focus').click();expect(await scroll.evaluate(node=>node.scrollTop)).toBeGreaterThan(900);
});

for(const route of ['diff','calculator'])test(`${route} reflows at 200 percent text size in a 320px viewport`,async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto(`/${route}.html`);await page.addStyleTag({content:'html{font-size:200%!important}'});await expect.poll(()=>page.locator('main').evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
});
