import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('language dropdown search focus stays inside the search box after Burmese and RTL switches',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-pattern').fill('keep_this_pattern');
 const control=page.locator('.language-control .choices'),search=control.locator('input[type=search]');
 for(const code of ['my','ar']){
  await page.setViewportSize({width:code==='my'?1440:640,height:900});
  await selectLanguage(page,code);await page.locator('#settings-open').click();await control.click();await expect(search).toBeFocused();
  const bounds=await search.evaluate(input=>{
   const style=getComputedStyle(input),box=input.getBoundingClientRect();
   const list=input.parentElement.querySelector('.choices__list').getBoundingClientRect();
   const outside=style.outlineStyle==='none'?0:Math.max(0,parseFloat(style.outlineWidth)+parseFloat(style.outlineOffset));
   return {focusBottom:box.bottom+outside,listTop:list.top,focusWidth:parseFloat(style.outlineWidth),focusStyle:style.outlineStyle};
  });
  expect(bounds.focusStyle).not.toBe('none');expect(bounds.focusWidth).toBeGreaterThanOrEqual(1);
  expect(bounds.focusBottom,'search focus ring must not cover the first visible option').toBeLessThanOrEqual(bounds.listTop);
  await search.fill('en');await expect(control.locator('[data-choice][data-value="en"]')).toBeVisible();
  await search.press('Escape');await expect(control).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('#regex-pattern')).toHaveValue('keep_this_pattern');await page.locator('#settings-close').click();
 }
 await page.locator('#settings-open').click();await control.click();await search.fill('zh-Hans');await control.locator('[data-choice][data-value="zh-Hans"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','zh-Hans');await expect(control).toHaveAttribute('aria-expanded','false');
});
