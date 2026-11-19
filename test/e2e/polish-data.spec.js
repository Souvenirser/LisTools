import {activeTool} from './task-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
const input=page=>activeTool(page).locator('#convert-source .cm-content');
const output=page=>activeTool(page).locator('#convert-result .cm-content');

test('empty diff mode changes stay idle until an explicit comparison',async({page})=>{
 await page.goto('/diff.html');await activeTool(page).locator('#diff-mode').selectOption('text');await expect(activeTool(page).locator('body')).toHaveAttribute('data-status','idle');
 await activeTool(page).locator('#diff-mode').selectOption('json');await expect(activeTool(page).locator('body')).toHaveAttribute('data-status','idle');
 await activeTool(page).locator('#diff-mode').selectOption('text');await activeTool(page).locator('#compare').click();await expect(activeTool(page).locator('body')).toHaveAttribute('data-status','ready');await expect(activeTool(page).locator('#diff-total')).toContainText(/相同|identical|same/i);
});
test('coarse diff worker results disclose broad blocks',async({page})=>{
 await page.goto('/diff.html');await selectLanguage(page,'en');await activeTool(page).locator('#diff-mode').selectOption('text');
 await activeTool(page).locator('#left-source .cm-content').fill('x'.repeat(17000)+'A');await activeTool(page).locator('#right-source .cm-content').fill('x'.repeat(17000)+'B');await activeTool(page).locator('#compare').click();
 await expect(activeTool(page).locator('#diff-total')).toContainText('difference blocks');await expect(activeTool(page).locator('#diff-coarse')).toContainText('may include unchanged');
});
test('CSV errors name the corrective option and locate explicit failures',async({page})=>{
 await page.goto('/convert.html#csv-json');await selectLanguage(page,'en');await activeTool(page).locator('#convert-auto').uncheck();await input(page).fill('a,a\n1,2');await activeTool(page).locator('#convert-run').click();
 await expect(activeTool(page).locator('#convert-status')).toContainText('Rename them or disable Header row');await expect(activeTool(page).locator('#convert-status')).toBeFocused();await expect(activeTool(page).locator('#convert-error-detail')).toHaveAttribute('open','');
});
test('hex fallback identifies charset and downloads original bytes',async({page})=>{
 await page.goto('/convert.html#hex');await selectLanguage(page,'en');await activeTool(page).locator('#convert-auto').uncheck();await activeTool(page).locator('#convert-direction-switch button[data-value="decode"]').click();await input(page).fill('ff00');await activeTool(page).locator('#convert-run').click();
 await expect(activeTool(page).locator('#convert-notice')).toContainText('utf-8');await expect(activeTool(page).locator('#convert-notice')).toContainText('Hex');
 const pending=page.waitForEvent('download');await activeTool(page).locator('#convert-download').click();const stream=await(await pending).createReadStream(),parts=[];for await(const part of stream)parts.push(part);expect(Buffer.concat(parts)).toEqual(Buffer.from([255,0]));
});
test('charset source selector follows actual input mode',async({page})=>{
 await page.goto('/convert.html#charset');await selectLanguage(page,'en');await expect(activeTool(page).locator('#option-from')).toBeDisabled();await expect(activeTool(page).locator('#convert-charset-note')).toContainText('already Unicode');
 await activeTool(page).locator('#input-mode').selectOption('file');await expect(activeTool(page).locator('#option-from')).toBeEnabled();await activeTool(page).locator('#input-mode').selectOption('text');await expect(activeTool(page).locator('#option-from')).toBeDisabled();
});
for(const id of ['xml-json','query-json','csv-json'])test(`${id} examples round trip and ask before replacing user data`,async({page})=>{
 await page.goto('/convert.html#'+id);await selectLanguage(page,'en');await activeTool(page).locator('#convert-auto').uncheck();await activeTool(page).locator('#convert-example').click();await activeTool(page).locator('#convert-run').click();await expect(activeTool(page).locator('#convert-output-panel')).toHaveAttribute('data-status','ready');
 const first=await output(page).innerText(),original=await input(page).innerText();
 if(id==='xml-json')expect(JSON.parse(first)).toEqual([{root:[{'#text':'before'},{item:[{'#text':'中'}]},{'#text':'after'}],':@':{'@_id':'001'}}]);
 if(id==='query-json')expect(JSON.parse(first)).toEqual({tag:['a','b'],empty:[''],space:['hello world']});
 if(id==='csv-json')expect(JSON.parse(first)).toEqual([{id:1,value:{active:true}},{id:2,value:null}]);await activeTool(page).locator('#convert-direction-switch button[data-value="decode"]').click();
 page.once('dialog',dialog=>dialog.dismiss());await activeTool(page).locator('#convert-example').click();expect(await input(page).innerText()).toBe(original);
 page.once('dialog',dialog=>dialog.accept());await activeTool(page).locator('#convert-example').click();await activeTool(page).locator('#convert-run').click();await expect(activeTool(page).locator('#convert-output-panel')).toHaveAttribute('data-status','ready');
 expect(await output(page).innerText()).toBe(id==='csv-json'?original.replace(/\n/g,'\r\n'):original);if(id==='csv-json')await expect(activeTool(page).locator('#option-cells')).toHaveValue('json');
});

test('automatic CSV errors leave the editing focus in place',async({page})=>{
 await page.goto('/convert.html#csv-json');await selectLanguage(page,'en');await activeTool(page).locator('#convert-auto').check();await input(page).fill('a,a\n1,2');await expect(activeTool(page).locator('#convert-status')).toContainText('Rename them');await expect(input(page)).toBeFocused();
});
test('charset file imports immediately show the active file source encoding',async({page})=>{
 await page.goto('/convert.html#charset');await selectLanguage(page,'en');await activeTool(page).locator('#convert-file').setInputFiles({name:'source.txt',mimeType:'text/plain',buffer:Buffer.from('abc')});
 await expect(activeTool(page).locator('#option-from')).toBeEnabled();await expect(activeTool(page).locator('#convert-input-panel h2')).toContainText('utf-8');
 await activeTool(page).locator('#convert-clear').click();await expect(activeTool(page).locator('#convert-input-panel h2')).toContainText('Unicode');
});
