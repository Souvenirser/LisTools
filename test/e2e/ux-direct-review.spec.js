import {activeTool} from './task-helpers.js';
import {chooseConversionTool} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {selectLanguage} from './language-helpers.js';

const file=(name,text)=>({name,mimeType:'text/plain',buffer:Buffer.from(text)});
async function downloadBytes(page,button){const pending=page.waitForEvent('download');await button.click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}

for(const action of ['converter edit','MD5 edit','MD5 clear'])test(`MD5 file handoff preserves the latest text after ${action}`,async({page})=>{
 await page.goto('/convert.html#base64');await selectLanguage(page,'en');await activeTool(page).locator('#convert-auto').uncheck();
 const source=activeTool(page).locator('#convert-source .cm-content');await source.fill('old parked text');
 await activeTool(page).locator('#convert-file').setInputFiles(file('first.txt','first file'));await expect(source).toHaveText('first file');
 await activeTool(page).locator('#input-mode').selectOption('text');await expect(source).toHaveText('old parked text');await source.fill('latest converter text');
 await chooseConversionTool(page,'#convert-tool-list a[href="#md5"]');await activeTool(page).locator('#md5-auto').uncheck();
 if(action==='MD5 edit')await source.fill('latest MD5 text');
 await activeTool(page).locator('#md5-mode').selectOption('files');await activeTool(page).locator('#md5-files').setInputFiles(file('second.txt','second file'));
 if(action==='MD5 clear')await activeTool(page).locator('#md5-clear').click();
 await chooseConversionTool(page,'#convert-tool-list a[href="#base64"]');await expect(activeTool(page).locator('#input-mode')).toHaveValue('file');
 await activeTool(page).locator('#input-mode').selectOption('text');await expect(source).toHaveText(action==='MD5 clear'?'':action==='MD5 edit'?'latest MD5 text':'latest converter text');
});

test('narrow PDF inspection keeps cancellation visible and preserves the downloadable result',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{const Native=Worker;window.Worker=class extends Native{postMessage(data,...args){if(data.options?.mode==='inspect'){window.releasePdfInspection=()=>super.postMessage(data,...args);return;}return super.postMessage(data,...args);}};});
 await page.goto('/pdf.html');await selectLanguage(page,'en');
 const sample=JSON.parse(readFileSync('src/tools/pdf/examples.json','utf8'))[0];
 await activeTool(page).locator('#pdf-files').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:Buffer.from(sample,'base64')});await activeTool(page).locator('#pdf-run').click();
 await expect(activeTool(page).locator('#pdf-result')).toBeVisible();const before=await downloadBytes(page,activeTool(page).locator('#pdf-download'));
 await activeTool(page).locator('#pdf-inspect').click();await page.waitForFunction(()=>Boolean(window.releasePdfInspection));await activeTool(page).locator('#pdf-result').scrollIntoViewIfNeeded();
 await expect(activeTool(page).locator('#pdf-cancel')).toBeEnabled();await expect(activeTool(page).locator('#pdf-cancel')).toBeVisible();await expect(activeTool(page).locator('.workspace-action-area')).toHaveAttribute('data-action-state','pending');
 await activeTool(page).locator('#pdf-cancel').click();await expect(activeTool(page).locator('#tool-status')).toContainText(/cancelled/i);await expect(activeTool(page).locator('#pdf-result')).toBeVisible();
 expect(await downloadBytes(page,activeTool(page).locator('#pdf-download'))).toEqual(before);
});
