import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('visible invalid HMS input cannot start a previous countdown',async({page})=>{
 await page.goto('/timer.html');
 for(const [hours,minutes,seconds] of [[0,5,99],[0,60,0],[0,0,0],[8761,0,0]]){
  await page.locator('#timer-hours').fill(String(hours));await page.locator('#timer-minutes').fill(String(minutes));await page.locator('#timer-seconds').fill(String(seconds));await page.locator('#timer-start').click();
  await expect(page.locator('#timer-start')).toBeEnabled();await expect(page.locator('#tool-status')).toBeVisible();
 }
 await page.locator('#timer-hours').fill('0');await page.locator('#timer-minutes').fill('0');await page.locator('#timer-seconds').fill('10');await page.locator('#timer-start').click();await expect(page.locator('#timer-start')).toBeDisabled();
});

test('ordinary and long timer displays fit narrow cards at normal and doubled text size',async({page})=>{
 for(const width of [320,390])for(const font of ['100%','200%']){
  await page.setViewportSize({width,height:844});await page.goto('/timer.html');await page.addStyleTag({content:`html{font-size:${font} !important}`});
  for(const hours of ['0','8760']){
   await page.locator('#timer-hours').fill(hours);await page.locator('#timer-hours').blur();
   const overflow=await page.locator('#timer-display').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const a=range.getBoundingClientRect(),b=el.getBoundingClientRect();return Math.max(b.left-a.left,a.right-b.right);});expect(overflow,`${width}/${font}/${hours}`).toBeLessThanOrEqual(1);
  }
 }
});

test('MD5 file results wrap in mobile cards and translate their accessible label',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/convert.html#md5');await page.locator('#md5-mode').selectOption('files');await page.locator('#md5-files').setInputFiles({name:'abc.txt',mimeType:'text/plain',buffer:Buffer.from('abc')});await page.locator('#md5-run').click();const digest=page.locator('[data-file-digest]');await expect(digest).toHaveValue('900150983cd24fb0d6963f7d28e17f72');
 expect(await page.locator('.md5-table-wrap').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await selectLanguage(page,'de');await expect(digest).toHaveAttribute('aria-label','Prüfsumme');await expect(digest).toHaveValue('900150983cd24fb0d6963f7d28e17f72');
});

test('first conversion failure has a translated technical details title',async({page})=>{
 await page.goto('/convert.html#json-yaml');await page.locator('#convert-source .cm-content').fill('{bad}');await page.locator('#convert-run').click();const summary=page.locator('#convert-error-detail summary');await expect(summary).toHaveText('Technical details');await expect(page.locator('#convert-error-detail')).toBeVisible();await selectLanguage(page,'de');await expect(summary).not.toHaveText('Technical details');await expect(summary).not.toBeEmpty();
});

test('HSV conversion shows a canonical color swatch',async({page})=>{
 await page.goto('/convert.html#color');await page.locator('#option-format').selectOption('hsv');await page.locator('#convert-source .cm-content').fill('#ff0000');await page.locator('#convert-run').click();await expect(page.locator('#convert-color')).toBeVisible();await expect(page.locator('#convert-color')).toHaveCSS('background-color','rgb(255, 0, 0)');
});

test('choosing the current conversion closes its compact catalog',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/convert.html#base64');await page.locator('#convert-catalog-toggle').click();await page.locator('#convert-tool-list a[href="#base64"]').click();await expect(page.locator('.convert-catalog')).toBeHidden();
});

test('regex task buttons update the primary action through language changes',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-task-replace').click();await expect(page.locator('#regex-run')).toHaveText('Replace');await page.locator('#regex-task-extract').click();await expect(page.locator('#regex-run')).toHaveText('Extract matches');await selectLanguage(page,'de');await expect(page.locator('#regex-run')).not.toHaveText('Run');await expect(page.locator('#regex-run')).not.toHaveAttribute('data-i18n');
});
