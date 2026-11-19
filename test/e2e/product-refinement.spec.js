import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {activeTool,chooseTask} from './task-helpers.js';
import {selectLanguage} from './language-helpers.js';
async function pdf(name,widths){const doc=await PDFDocument.create();for(const width of widths)doc.addPage([width,200]);return {name,mimeType:'application/pdf',buffer:Buffer.from(await doc.save())};}
async function open(page,id){await page.goto('/'+id+'.html');await selectLanguage(page,'en');}
async function output(page,id){const pending=page.waitForEvent('download');await activeTool(page).locator('#'+id+'-download').click();const download=await pending;const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}

test('PDF rejects unsupported imports without discarding the existing valid result',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100,200])]);await activeTool(page).locator('#pdf-run').click();await expect(activeTool(page).locator('#pdf-result')).toBeVisible();const original=await output(page,'pdf');
 await activeTool(page).locator('#pdf-files').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('unsupported')});
 await expect(activeTool(page).locator('#pdf-queue .media-file-name')).toHaveCount(1);await expect(activeTool(page).locator('#pdf-result')).toBeVisible();expect(await output(page,'pdf')).toEqual(original);await expect(activeTool(page).locator('#pdf-import-errors')).toContainText('notes.txt');
});
test('PDF mixed import accepts valid documents and reports rejected names',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100]),{name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('bad')}]);await expect(activeTool(page).locator('#pdf-queue .media-file-name')).toHaveCount(1);await expect(activeTool(page).locator('#pdf-import-errors')).toContainText('notes.txt');await activeTool(page).locator('#pdf-run').click();await expect(activeTool(page).locator('#pdf-result')).toBeVisible();
});
test('PDF single-document tasks require an explicit current file while preserving the queue',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100,150]),await pdf('b.pdf',[300,400])]);await chooseTask(page,'pdf','extract');await expect(activeTool(page).locator('#pdf-run')).toBeDisabled();await expect(activeTool(page).locator('#pdf-active-file')).toBeVisible();await activeTool(page).locator('#pdf-active-file').selectOption({label:'b.pdf'});await activeTool(page).locator('#pdf-pages').fill('2');await activeTool(page).locator('#pdf-run').click();await expect(activeTool(page).locator('#pdf-result')).toBeVisible();expect((await PDFDocument.load(await output(page,'pdf'))).getPage(0).getWidth()).toBe(400);await expect(activeTool(page).locator('#pdf-queue .media-file-name')).toHaveCount(2);
 await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#pdf-active-file option:checked')).toHaveText('b.pdf');await expect(activeTool(page).locator('#pdf-result')).toBeVisible();
});
test('PDF generated output updates source page counts and gives a visible download',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100,150]),await pdf('b.pdf',[300])]);await activeTool(page).locator('#pdf-run').click();await expect(activeTool(page).locator('#pdf-result')).toBeVisible();await expect(activeTool(page).locator('#pdf-queue')).not.toContainText('not read');await expect(activeTool(page).locator('#pdf-queue')).toContainText('2 pages');const box=await activeTool(page).locator('#pdf-download').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(900);
});
test('email search does not offer PDF extraction',async({page})=>{
 await open(page,'pdf');await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('email');await expect(page.locator('[data-target="text.html#extract"]')).toBeVisible();await expect(page.locator('[data-target="pdf.html#extract"]')).toHaveCount(0);
});

test('image compression has explicit quality and target modes with a first-screen download',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await open(page,'images');await activeTool(page).locator('#images-files').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});await expect(activeTool(page).locator('#images-compression-mode')).toHaveValue('quality');await expect(activeTool(page).locator('#images-target')).toBeHidden();await activeTool(page).locator('#images-compression-mode').selectOption('target');await expect(activeTool(page).locator('#images-target')).toBeVisible();await activeTool(page).locator('#images-target').fill('64');await activeTool(page).locator('#images-run').click();await expect(activeTool(page).locator('#images-results')).toBeVisible();await expect(activeTool(page).locator('#images-download')).toBeVisible();const box=await activeTool(page).locator('#images-download').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(900);await expect(activeTool(page).locator('#images-result-summary')).toContainText('1');
});
test('PDF images mode rejects PDF additions and keeps the previous queue',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100])]);await chooseTask(page,'pdf','images');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('b.pdf',[200])]);await expect(activeTool(page).locator('#pdf-queue .media-file-name')).toHaveCount(1);await expect(activeTool(page).locator('#pdf-import-errors')).toContainText('b.pdf');await expect(activeTool(page).locator('#pdf-run')).toBeDisabled();
});

test('target-size editing and task switching preserve the chosen compression method',async({page})=>{
 await open(page,'images');await activeTool(page).locator('#images-files').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});await activeTool(page).locator('#images-compression-mode').selectOption('target');await activeTool(page).locator('#images-target').fill('');await expect(activeTool(page).locator('#images-target')).toBeVisible();await expect(activeTool(page).locator('#images-compression-mode')).toHaveValue('target');await activeTool(page).locator('#images-target').fill('64');await chooseTask(page,'images','resize');await chooseTask(page,'images','compress');await expect(activeTool(page).locator('#images-compression-mode')).toHaveValue('target');await expect(activeTool(page).locator('#images-target')).toHaveValue('64');
});
test('PDF image input does not display an unread PDF page-count label',async({page})=>{
 await open(page,'pdf');await chooseTask(page,'pdf','images');await activeTool(page).locator('#pdf-files').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});await expect(activeTool(page).locator('#pdf-queue')).toContainText('photo.png');await expect(activeTool(page).locator('#pdf-queue')).not.toContainText('Page count not read');await activeTool(page).locator('#pdf-run').click();await expect(activeTool(page).locator('#pdf-output-info')).toContainText('1 pages');
});

test('removing the explicitly selected PDF requires a new selection',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100,200]),await pdf('b.pdf',[300,400])]);await chooseTask(page,'pdf','extract');await activeTool(page).locator('#pdf-active-file').selectOption({label:'a.pdf'});await activeTool(page).locator('#pdf-queue li').filter({hasText:'a.pdf'}).getByRole('button',{name:'Remove · a.pdf',exact:true}).click();await expect(activeTool(page).locator('#pdf-active-file')).toHaveValue('');await expect(activeTool(page).locator('#pdf-run')).toBeDisabled();await activeTool(page).locator('#pdf-active-file').selectOption({label:'b.pdf'});await expect(activeTool(page).locator('#pdf-run')).toBeEnabled();
});
test('the chosen PDF survives an images task round trip and language change',async({page})=>{
 await open(page,'pdf');await activeTool(page).locator('#pdf-files').setInputFiles([await pdf('a.pdf',[100]),await pdf('b.pdf',[300])]);await chooseTask(page,'pdf','extract');await activeTool(page).locator('#pdf-active-file').selectOption({label:'b.pdf'});await chooseTask(page,'pdf','images');await chooseTask(page,'pdf','extract');await expect(activeTool(page).locator('#pdf-active-file option:checked')).toHaveText('b.pdf');await selectLanguage(page,'de');await expect(activeTool(page).locator('#pdf-active-file option:checked')).toHaveText('b.pdf');
});
test('quality-mode task switching keeps inactive target controls hidden and headings accurate',async({page})=>{
 await open(page,'images');await activeTool(page).locator('#images-files').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});await chooseTask(page,'images','resize');await expect(activeTool(page).locator('#images-settings>h2')).toHaveText('Change width and height');await chooseTask(page,'images','compress');await expect(activeTool(page).locator('#images-compression-mode')).toHaveValue('quality');await expect(activeTool(page).locator('#images-target')).toBeHidden();await expect(activeTool(page).locator('#images-reduce')).toBeHidden();await expect(activeTool(page).locator('#images-result-summary h2')).toHaveText('Processed images');
});
