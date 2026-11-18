import {test,expect} from '@playwright/test';
import {pages,taskRoutes} from '../../src/tools/shared/navigation.js';
import {tools} from '../../src/tools/convert/registry.js';
import {selectLanguage} from './language-helpers.js';
import {activeTool} from './task-helpers.js';

const settled=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

test('open menu follows task changes and browser history without stale selection',async({page})=>{
 for(const [file,from,to,query,before,after]of [
  ['convert','md5','hex','','convert.html#md5','convert.html'],
  ['qr','generate','recognize','qr','qr.html#generate','qr.html#recognize'],
  ['dates','difference','workdays','date','dates.html#difference','dates.html#workdays']
 ]){
  await page.goto(`/${file}.html#${from}`);await page.locator('button.brand').click();await settled(page);
  if(query)await page.locator('#tool-menu-search').fill(query);
  const current=page.locator('#tool-menu a[aria-current="page"]');await expect(current).toHaveCount(1);await expect(current).toHaveAttribute('data-target',before);
  await page.evaluate(hash=>{location.hash=hash;},to);await expect(current).toHaveCount(1);await expect(current).toHaveAttribute('data-target',after);
  await page.evaluate(()=>history.back());await expect(page).toHaveURL(new RegExp(`#${from}$`));await expect(current).toHaveAttribute('data-target',before);
  await page.evaluate(()=>history.forward());await expect(page).toHaveURL(new RegExp(`#${to}$`));await expect(current).toHaveAttribute('data-target',after);
  await page.keyboard.press('Escape');
 }
});

for(const language of ['zh-Hans','en','de','ar','ru'])test(`${language} menu and page heading use the same complete tool name`,async({page})=>{
 test.setTimeout(120000);
 await page.goto('/index.html');await selectLanguage(page,language);
 for(const entry of pages){
  await page.goto('/'+entry.file);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');const heading=(await activeTool(page).getByRole('heading',{level:1}).innerText()).trim();await page.locator('button.brand').click();await settled(page);
  await expect(page.locator('#tool-menu a[aria-current="page"] .tool-menu-name')).toHaveText(heading);await page.locator('#tool-menu-search').press('Escape');
 }
});

for(const width of [1440,390])test(`all tool, conversion and task routes keep one current entry at ${width}px`,async({page})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width,height:900});
 const tool=activeTool(page);
 const routes=[...new Set([...pages.map(page=>page.file),...tools.map(tool=>'convert.html#'+tool.id),...Object.entries(taskRoutes).flatMap(([id,tasks])=>tasks.map(task=>`${id}.html#${task}`))])];
 for(const route of routes){
  await page.goto('/'+route);await expect(tool.locator('html')).toHaveAttribute('data-ui-state','ready');const [file,task]=route.split('#');
  const selectedTask=tool.locator('.task-guide [data-task][aria-pressed="true"]');
  if(await tool.locator('.task-guide').count())await expect(selectedTask).toHaveCount(1);
  if(file==='tax.html'&&task==='wage')await expect(tool.locator('#tax-salary')).toBeVisible();
  else if(file==='tax.html'&&task)await expect(tool.locator(`#tax-${task}-section`)).toHaveJSProperty('open',true);
  else if(taskRoutes[file.replace('.html','')]?.includes(task))await expect(selectedTask).toHaveAttribute('data-task',task);
  const picker=tool.locator('.task-select-label select');if(await picker.count())await expect(picker).toHaveValue(await selectedTask.getAttribute('data-task'));
  if(file==='convert.html'){const selected=tool.locator('#convert-tool-list a[aria-current="page"]');await expect(selected).toHaveCount(1);await expect(selected).toHaveAttribute('href','#'+(task||'base64'));}
  await page.locator('button.brand').click();await settled(page);const current=page.locator('#tool-menu a[aria-current="page"]');await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute('data-target',file==='convert.html'&&task==='md5'?'convert.html#md5':file);await page.locator('#tool-menu-search').press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),route).toBeLessThanOrEqual(1);
 }
});
