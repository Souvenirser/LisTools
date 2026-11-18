import {test,expect} from '@playwright/test';
import {pages} from '../../src/tools/shared/navigation.js';
import {activeTool} from './task-helpers.js';

test('all packaged pages load without external requests or JavaScript errors',async({page})=>{
  const errors=[],external=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
  for(const {file,standalone} of pages.filter(item=>!item.file.includes('#'))) {
    await page.goto(`/${file}`);await expect(page.locator('#settings-open')).toBeVisible();
    await expect((standalone?page:activeTool(page)).locator('html')).toHaveAttribute('data-ui-state','ready');
    await page.locator('button.brand').click();await expect(page.locator('#tool-menu')).toBeVisible();await page.locator('#tool-menu-search').press('Escape');await expect(page.locator('#tool-menu')).toBeHidden();
  }
  expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('JSON precision and structural diff run in their local workers',async({page})=>{
  const tool=activeTool(page);
  await page.goto('/index.html');await tool.locator('#source .cm-content').fill('{"large":9007199254740993123}');await tool.locator('#format').click();
  await expect(tool.locator('#copy')).toBeEnabled();await expect(tool.locator('#editor')).toContainText('9007199254740993123');
  await page.goto('/diff.html');await tool.locator('#left-source .cm-content').fill('{"large":9007199254740993123}');await tool.locator('#right-source .cm-content').fill('{"large":9007199254740993124}');await tool.locator('#compare').click();await expect(tool.locator('#diff-length')).toHaveText('1');
});

test('timezone conversion and MD5 keep exact output in each engine',async({page})=>{
  const tool=activeTool(page);
  await page.goto('/timestamp.html');const zones=tool.locator('.timezone-controls .choices');await zones.click();await zones.locator('input[type=search]').fill('UTC');await zones.locator('[data-choice][data-value="UTC"]').click();await tool.locator('#timestamp-source').fill('0');await expect(tool.locator('#timestamp-local')).toHaveValue('1970-01-01 00:00:00.000');
  await page.goto('/convert.html#md5');await tool.locator('#convert-source .cm-content').fill('abc');await expect(tool.locator('#md5-values textarea').first()).toHaveValue('900150983cd24fb0d6963f7d28e17f72');
});

for(const namespace of ['browser','chrome','both'])test(`popup opens a tool using the ${namespace} extension API`,async({page})=>{
  await page.addInitScript(mode=>{
    window.extensionLaunches=[];
    const api=name=>({tabs:{async create(options){window.extensionLaunches.push({api:name,url:options.url});}}});
    Object.defineProperty(window,'browser',{value:mode==='chrome'?undefined:api('browser'),configurable:true});
    if(window.chrome)Object.defineProperty(window.chrome,'tabs',{value:mode==='browser'?undefined:api('chrome').tabs,configurable:true});else Object.defineProperty(window,'chrome',{value:mode==='browser'?undefined:api('chrome'),configurable:true});
    window.close=()=>{window.popupClosed=true;};
  },namespace);
  await page.goto('/popup.html');
  await page.locator('#tool-menu-search').fill('base64url');
  await page.locator('a[data-target="convert.html#base64url"]').click();
  await expect.poll(()=>page.evaluate(()=>window.extensionLaunches)).toEqual([{api:namespace==='chrome'?'chrome':'browser',url:new URL('/convert.html#base64url',page.url()).href}]);
  await expect.poll(()=>page.evaluate(()=>window.popupClosed)).toBe(true);
});
