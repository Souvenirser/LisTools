import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {selectLanguage} from './language-helpers.js';
import {chooseTask} from './task-helpers.js';
const png={name:'image.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')};
const pdfs=JSON.parse(readFileSync('src/tools/pdf/examples.json','utf8')).map((data,index)=>({name:`source-${index+1}.pdf`,mimeType:'application/pdf',buffer:Buffer.from(data,'base64')}));
async function open(page,tool){await page.goto(`/${tool}.html`);await selectLanguage(page,'en');}
async function crop(page){await open(page,'images');await page.locator('#images-files').setInputFiles([png,{...png,name:'second.png'}]);await expect(page.locator('#images-queue .media-file-name')).toHaveCount(2);await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);await page.locator('#images-rotate').click();await expect(page.locator('#images-crop-state')).toContainText('Unsaved');}

test('QR file chooser is localized and no QR produces a neutral completed state',async({page})=>{
 await open(page,'qr');await chooseTask(page,'qr','recognize');await expect(page.locator('#qr-file')).toBeHidden();await expect(page.locator('#qr-drop')).toBeVisible();await page.locator('#qr-file').setInputFiles(png);await expect(page.locator('#qr-source-info')).toContainText('image.png');await expect(page.locator('#qr-source-info')).toContainText('128');await expect(page.locator('#tool-status')).toContainText(/No QR code/);await expect(page.locator('#tool-status')).not.toHaveClass(/is-error/);await expect(page.locator('#qr-copy')).toBeDisabled();await expect(page.locator('#qr-empty')).toContainText(/No QR code/);
});

test('declining a crop file switch preserves the current image and selection',async({page})=>{
 await crop(page);const before=await page.locator('cropper-selection').evaluate(node=>({x:node.x,y:node.y,width:node.width,height:node.height}));let asked=false;page.once('dialog',async dialog=>{asked=true;await dialog.dismiss();});await page.locator('#images-queue .media-queue-row').nth(1).getByRole('button',{name:'Edit crop · second.png',exact:true}).click();expect(asked).toBe(true);await expect(page.locator('#images-crop-name')).toHaveText('image.png');await expect(page.locator('#images-crop-state')).toContainText('Unsaved');expect(await page.locator('cropper-selection').evaluate(node=>({x:node.x,y:node.y,width:node.width,height:node.height}))).toEqual(before);await expect(page.locator('#images-queue [aria-current=true]')).toContainText('image.png');
});

for(const width of [1360,390])test(`declining a crop task switch preserves route and task at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});await crop(page);let asked=false;page.once('dialog',async dialog=>{asked=true;await dialog.dismiss();});await chooseTask(page,'images','compress');expect(asked).toBe(true);await expect(page).toHaveURL(/#crop$/);await expect(page.locator('#images-task-crop')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#images-task-select')).toHaveValue('crop');await expect(page.locator('#images-crop-panel')).toBeVisible();await expect(page.locator('#images-crop-state')).toContainText('Unsaved');
});

test('accepting a crop switch discards only unsaved adjustment and invalidates the prior export',async({page})=>{
 await crop(page);page.once('dialog',dialog=>dialog.accept());await chooseTask(page,'images','compress');await expect(page.locator('#images-crop-panel')).toBeHidden();await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);await page.locator('#images-apply').click();await expect(page.locator('#images-crop-state')).toContainText('Saved');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();await page.locator('#images-rotate').click();await expect(page.locator('#images-results')).toBeHidden();await expect(page.locator('#images-crop-state')).toContainText('Unsaved');
});

for(const tool of ['images','pdf'])test(`${tool} narrow queue disclosures keep reorder and remove bound to their file`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,tool);await page.locator(`#${tool}-files`).setInputFiles(tool==='images'?[png,{...png,name:'second.png'}]:pdfs);const rows=page.locator(`#${tool}-queue .media-queue-row`);await expect(rows).toHaveCount(2);const first=tool==='images'?'image.png':'source-1.pdf',second=tool==='images'?'second.png':'source-2.pdf';const details=rows.nth(1).locator('.media-file-actions');await expect(details).not.toHaveAttribute('open');await details.locator('summary').focus();await details.locator('summary').press('Enter');await details.getByRole('button',{name:`Move up · ${second}`,exact:true}).press('Enter');await expect(rows.first().locator('.media-file-name')).toContainText(second);await rows.first().locator('.media-file-actions summary').click();await rows.first().getByRole('button',{name:`Remove · ${second}`,exact:true}).click();await expect(rows).toHaveCount(1);await expect(rows.first().locator('.media-file-name')).toContainText(first);
});

test('text task controls and their main action share an aligned row',async({page})=>{
 await open(page,'text');
 for(const [task,id] of [['dedupe','text-lines'],['extract','text-kind'],['replace','text-find'],['mask','text-mask-phone'],['case','text-case'],['newline','text-newline']]){
  await chooseTask(page,'text',task);const field=task==='mask'?page.locator('.text-task-options>[data-options=mask]'):page.locator('#'+id);
  expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect.poll(async()=>{const control=await field.boundingBox(),button=await page.locator('#text-run').boundingBox();return Math.abs(task==='mask'?control.y+control.height/2-button.y-button.height/2:control.y-button.y);},{message:`${task} control and action alignment`}).toBeLessThan(1);
 }
});
