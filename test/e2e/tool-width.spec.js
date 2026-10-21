import { test, expect } from '@playwright/test';
import { pages } from '../../src/tools/shared/navigation.js';
import { selectLanguage } from './language-helpers.js';

test('tool workspaces fill the available width on wide screens',async({page})=>{
  await page.setViewportSize({width:2550,height:1107});
  for(const tool of pages.filter(tool=>!tool.file.includes('#'))){
    await page.goto(`/${tool.file}`);
    const box=await page.locator('main').evaluate(main=>{
      const root=main.querySelector('#tool-root')||main,style=getComputedStyle(main);
      return {actual:root.getBoundingClientRect().width,available:main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)};
    });
    expect(box.actual,`${tool.id}: workspace should use available main width`).toBeGreaterThanOrEqual(box.available-2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tool.id).toBe(true);
  }
});

test('tool workspaces retain narrow RTL layouts after removing the width cap',async({page})=>{
  await page.setViewportSize({width:640,height:960});
  for(const tool of pages.filter(tool=>!tool.file.includes('#'))){
    await page.goto(`/${tool.file}`);await selectLanguage(page,'ar');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tool.id).toBe(true);
  }
});
