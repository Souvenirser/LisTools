import {test,expect} from '@playwright/test';
import {pages} from '../../src/tools/shared/navigation.js';
import {selectLanguage} from './language-helpers.js';
const maxima={timestamp:1600,speedtest:1920,cron:1600,password:1120,calculator:804,dates:1120,qr:1600,images:1600,units:1120,money:1120,pdf:1600,draw:1440,timer:960};
test('workspaces use task-sized columns and readable controls on wide screens',async({page})=>{
 await page.setViewportSize({width:2560,height:1440});
 for(const tool of pages.filter(tool=>!tool.file.includes('#'))){
  await page.goto(`/${tool.file}`);
  const box=await page.locator('main').evaluate(main=>{const root=main.querySelector('#tool-root')||main,style=getComputedStyle(main);return {actual:root.getBoundingClientRect().width,font:parseFloat(style.fontSize),available:main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)};});
  expect(box.font,tool.id).toBe(16);
  if(maxima[tool.id])expect(box.actual,tool.id).toBeLessThanOrEqual(maxima[tool.id]+(tool.id==='timestamp'?48:1));else expect(box.actual,tool.id).toBeGreaterThanOrEqual(box.available-2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tool.id).toBe(true);
 }
});
test('all tasks retain narrow RTL reflow without horizontal page overflow',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 for(const tool of pages.filter(tool=>!tool.file.includes('#'))){await page.goto(`/${tool.file}`);await selectLanguage(page,'ar');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tool.id).toBe(true);}
});
