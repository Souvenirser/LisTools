import {startMenuSorting} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('menu ordering strip has equal top and bottom clearance in page and popup',async({page})=>{
 for(const route of ['/diff.html','/popup.html']){
  await page.goto(route);if(route!=='/popup.html')await page.locator('.brand').click();
  await startMenuSorting(page);const gap=await page.locator('.tool-menu-order-actions').evaluate(node=>{const row=node.getBoundingClientRect();return Math.max(...[...node.querySelectorAll('button')].map(button=>{const box=button.getBoundingClientRect();return Math.abs(box.top+box.height/2-row.top-row.height/2);}));});
  expect(gap).toBeLessThanOrEqual(1);
 }
});

for(const locale of ['en','de','ar'])test(`diff header controls do not cover the first document line in ${locale}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/diff.html');if(locale!=='en')await selectLanguage(page,locale);
 for(const side of ['left','right']){
  const geometry=await page.locator(`[data-diff-side="${side}"]`).first().evaluate(panel=>{const heading=panel.querySelector('.panel-heading'),source=panel.querySelector('.diff-source').getBoundingClientRect();return[...heading.children].filter(node=>node.checkVisibility()).every(node=>node.getBoundingClientRect().bottom<=source.top+1);});
  expect(geometry).toBe(true);
 }
});

test('a refused diff file import preserves the existing comparison and navigation',async({page})=>{
 await page.goto('/diff.html');await page.locator('#left-source .cm-content').fill('{"a":1,"b":2}');await page.locator('#right-source .cm-content').fill('{"a":3,"b":4}');await page.locator('#compare').click();
 await expect(page.locator('.cm-mergeView')).toBeVisible();await expect(page.locator('#next')).toBeEnabled();await page.locator('#next').click();
 const index=await page.locator('#diff-index').inputValue();const summary=await page.locator('#diff-total').textContent();
 await page.locator('.cm-mergeView').evaluate(node=>{node.dataset.preservedComparison='yes';});
 await page.locator('#left-file-input').setInputFiles({name:'invalid-utf8.json',mimeType:'application/json',buffer:Buffer.from([0xff,0xfe,0x7b])});
 await expect(page.locator('#diff-error-panel')).toBeVisible();
 await expect(page.locator('.cm-mergeView[data-preserved-comparison="yes"]')).toBeVisible();
 await expect(page.locator('#diff-index')).toHaveValue(index);await expect(page.locator('#diff-total')).toHaveText(summary);
 await page.locator('#previous').click();await expect(page.locator('#diff-index')).toHaveValue('1');
});

test('cancelled diff file reading keeps the previous result and permits retry',async({page})=>{
 await page.goto('/diff.html');await page.locator('#left-source .cm-content').fill('{"a":1}');await page.locator('#right-source .cm-content').fill('{"a":2}');await page.locator('#compare').click();await expect(page.locator('.cm-mergeView')).toBeVisible();
 await page.evaluate(()=>{window.releaseDiffRead=undefined;const read=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow.json')return new Promise(resolve=>{window.releaseDiffRead=()=>read.call(this).then(resolve);});return read.call(this);};});
 await page.locator('.cm-mergeView').evaluate(node=>node.dataset.preservedComparison='yes');
 await page.locator('#left-file-input').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from('{"a":99}')});await expect(page.locator('#cancel')).toBeVisible();await page.locator('#cancel').click();
 await page.evaluate(()=>window.releaseDiffRead());await expect(page.locator('.cm-mergeView[data-preserved-comparison="yes"]')).toBeVisible();
 await page.locator('#compare').click();await expect(page.locator('.cm-merge-a .cm-content')).toContainText('1');
});

test('menu storage updates preserve focused tool and scroll position',async({page})=>{
 await page.goto('/diff.html');await page.locator('.brand').click();
 for(const group of await page.locator('#tool-menu details').all())await group.evaluate(node=>node.open=true);
 const link=page.locator('#tool-menu [data-tool-id="regex"]');await link.focus();
 const before=await page.locator('.tool-menu-list').evaluate(node=>node.scrollTop);
 await page.evaluate(()=>{dispatchEvent(new StorageEvent('storage',{key:'listools-menu-order-v1'}));});
 await expect(link).toBeFocused();expect(await page.locator('.tool-menu-list').evaluate(node=>node.scrollTop)).toBeCloseTo(before,0);
});
