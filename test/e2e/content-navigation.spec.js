import {activeTool,chooseTask,countdownDuration} from './task-helpers.js';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const cases=[['index','#source .cm-content','{"keep":1}'],['diff','#left-source .cm-content','{"keep":1}'],['timestamp','#timestamp-source','123'],['convert','#convert-source .cm-content','keep'],['cron','#cron-expression','1 * * * *'],['password','#password-custom','abc'],['regex','#regex-source .cm-content','keep'],['calculator','#expression','2+3'],['dates','#date-amount','42'],['qr','#qr-input','keep'],['images',null],['text','#text-input','keep'],['units','#unit-value','42'],['money','#money-input','42'],['pdf',null],['draw','#draw-input','Alice'],['timer','#timer-seconds','42'],['speedtest',null]];
for(const [name,selector,value]of cases)test(`${name} menu protects current content and blank defaults navigate directly`,async({page,context})=>{
 await page.goto(`/${name}.html`);const target=name==='calculator'?'text':'calculator',tool=activeTool(page);
 await expect(tool.locator('html')).toHaveAttribute('data-ui-state','ready');
 const search=page.locator('#tool-menu-search'),link=page.locator(`#tool-menu a[data-target="${target}.html"]`);
 await page.locator('button.brand').click();await search.fill(target);await expect(link).not.toHaveAttribute('target','_blank');await search.press('Escape');
 if(name==='images')await tool.locator('#images-files').setInputFiles({name:'keep.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});
 else if(name==='pdf')await tool.locator('#pdf-files').setInputFiles({name:'keep.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')});
 else if(name==='speedtest'){await page.route('https://speed.cloudflare.com/**',route=>route.abort());await tool.locator('#speed-start').click();}
 else {if(name==='dates')await chooseTask(page,'dates','shift',tool);if(name==='password'){await tool.locator('details').filter({has:tool.locator('#password-custom-mode')}).locator('summary').click();await tool.locator('#password-custom-mode').check();}await tool.locator(selector).fill(value);}
 const originalUrl=page.url();await page.locator('button.brand').click();await search.fill(target);const pending=context.waitForEvent('page');await link.click();const opened=await pending;await expect(opened).toHaveURL(new URL(`/${target}.html`,originalUrl).href);expect(page.url()).toBe(originalUrl);if(selector)await expect(tool.locator(selector))[selector.includes('.cm-content')?'toHaveText':'toHaveValue'](value);await opened.close();
});
test('conversion subtools retain the same tab and input',async({page,context})=>{await page.goto('/convert.html#base64');const input=activeTool(page).locator('#convert-source .cm-content');await input.fill('keep');await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('MD5');await page.locator('#tool-menu a[data-target="convert.html#md5"]').click();await expect(page).toHaveURL(/#md5$/);expect(context.pages()).toHaveLength(1);await expect(input).toHaveText('keep');});
test('opening the toolbox cannot consume a countdown expiry',async({page})=>{
 await page.clock.install();await page.goto('/timer.html');const tool=activeTool(page);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.clock.pauseAt(new Date(Date.now()+10000));await countdownDuration(tool,1);await tool.locator('#timer-start').click();const started=await page.evaluate(()=>Date.now());await page.clock.setFixedTime(new Date(started+2000));await page.locator('button.brand').click();await page.clock.runFor(150);await expect(tool.locator('#tool-status')).toContainText(/complete|结束/);
});
