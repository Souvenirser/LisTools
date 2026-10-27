import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {selectLanguage} from './language-helpers.js';
import {chooseTask,tryExample} from './task-helpers.js';

const samples=JSON.parse(readFileSync('src/tools/pdf/examples.json','utf8'));
const pdfs=samples.map((data,index)=>({name:`source-${index+1}.pdf`,mimeType:'application/pdf',buffer:Buffer.from(data,'base64')}));
const png={name:'image.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')};
async function open(page,tool){await page.goto(`/${tool}.html`);await selectLanguage(page,'en');}
async function downloadBytes(page,button){const pending=page.waitForEvent('download');await button.click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}

test('PDF current choice refreshes the queue processing labels',async({page})=>{
 await open(page,'pdf');await page.locator('#pdf-files').setInputFiles(pdfs);await chooseTask(page,'pdf','extract');
 const names=page.locator('#pdf-queue .media-file-name');await expect(names).toHaveCount(2);
 await page.locator('#pdf-active-file').selectOption({label:'source-1.pdf'});await expect(names.nth(0)).not.toContainText('Not used');await expect(names.nth(1)).toContainText('Not used');
 await page.locator('#pdf-active-file').selectOption({label:'source-2.pdf'});await expect(names.nth(0)).toContainText('Not used');await expect(names.nth(1)).not.toContainText('Not used');
 await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();
});

test('PDF inspection retains the exact existing downloadable output',async({page})=>{
 await open(page,'pdf');await tryExample(page,'pdf');await expect(page.locator('#pdf-result')).toBeVisible();const before=await downloadBytes(page,page.locator('#pdf-download'));
 await page.locator('#pdf-inspect').click();await expect(page.locator('#pdf-result')).toBeVisible();await expect(page.locator('#tool-status')).toContainText(/page/i);expect(await downloadBytes(page,page.locator('#pdf-download'))).toEqual(before);await expect(page.locator('#tool-status')).not.toContainText(/outdated|changed|again/i);
});

test('PDF unusable queue explains the applicable input or selection',async({page})=>{
 await open(page,'pdf');await page.locator('#pdf-files').setInputFiles(pdfs);await chooseTask(page,'pdf','images');await expect(page.locator('#pdf-run')).toBeDisabled();await expect(page.locator('#pdf-run-reason')).toBeVisible();await expect(page.locator('#pdf-run-reason')).toContainText('PNG, JPG or WebP');
 await chooseTask(page,'pdf','extract');await expect(page.locator('#pdf-run')).toBeDisabled();await expect(page.locator('#pdf-run-reason')).toBeVisible();await expect(page.locator('#pdf-run-reason')).toContainText('Choose the PDF');
 await page.locator('#pdf-active-file').selectOption({label:'source-1.pdf'});await expect(page.locator('#pdf-run-reason')).toBeHidden();
});

test('PDF narrow task picker leaves no empty adjustment disclosure',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'pdf');await expect(page.locator('#pdf-task-select')).toBeVisible();await expect(page.getByText('Adjust pages',{exact:true})).toBeHidden();
});

test('QR recognition output explains its result and keeps imports in the input area',async({page})=>{
 await open(page,'qr');await chooseTask(page,'qr','recognize');await expect(page.locator('#qr-empty')).toContainText('Recognized text will appear here');await expect(page.locator('#qr-output-panel')).not.toContainText('Drop an image here');await expect(page.locator('#qr-drop')).toBeVisible();
});

for(const action of ['cancel','switch','replace'])test(`QR delayed image decode cannot overwrite ${action}`,async({page})=>{
 await page.addInitScript(()=>{const original=createImageBitmap;window.createImageBitmap=async function(source,...args){if(source.name==='slow.png')await new Promise(resolve=>window.releaseQrRead=resolve);const result=await original(source,...args);if(source.name==='slow.png')window.qrReadFinished=true;return result;};});
 await open(page,'qr');await chooseTask(page,'qr','recognize');await page.locator('#qr-file').setInputFiles({...png,name:'slow.png'});await page.waitForFunction(()=>Boolean(window.releaseQrRead));
 if(action==='cancel')await page.locator('#qr-cancel').click();else if(action==='switch')await chooseTask(page,'qr','generate');else{await page.locator('#qr-file').setInputFiles({...png,name:'replacement.png'});await expect(page.locator('#qr-source-image')).toBeVisible();}
 const image=await page.locator('#qr-source-image').getAttribute('src');await page.evaluate(()=>window.releaseQrRead());await page.waitForFunction(()=>window.qrReadFinished);if(image)await expect(page.locator('#qr-source-image')).toHaveAttribute('src',image);else await expect(page.locator('#qr-source-image')).not.toHaveAttribute('src');await expect(page.locator('#qr-result')).toHaveValue('');if(action==='switch')await expect(page.locator('#qr-input')).toBeVisible();
});

test('QR a superseded worker result cannot replace the latest recognized text',async({page})=>{
 await page.addInitScript(()=>{const NativeWorker=Worker;window.Worker=class extends NativeWorker{set onmessage(callback){super.onmessage=event=>{if(event.data.status==='ready'&&!window.releaseOldQrResult)window.releaseOldQrResult=()=>callback(event);else callback(event);};}};});
 await open(page,'qr');const images=[];for(const value of ['first QR','latest QR']){await page.locator('#qr-input').fill(value);await page.locator('#qr-generate').click();await expect(page.locator('#qr-canvas')).toBeVisible();images.push(await page.locator('#qr-canvas').screenshot());}
 await chooseTask(page,'qr','recognize');await page.locator('#qr-file').setInputFiles({...png,buffer:images[0]});await page.waitForFunction(()=>Boolean(window.releaseOldQrResult));await page.locator('#qr-file').setInputFiles({...png,buffer:images[1]});await expect(page.locator('#qr-result')).toHaveValue('latest QR');await page.evaluate(()=>window.releaseOldQrResult());await expect(page.locator('#qr-result')).toHaveValue('latest QR');
});

test('text result distinguishes idle, empty, success and stale and labels statistics',async({page})=>{
 await open(page,'text');await expect(page.locator('#text-operation-summary')).toBeVisible();await expect(page.locator('#text-operation-summary')).toContainText('Run an operation');
 await chooseTask(page,'text','extract');await page.locator('#text-input').fill('no email here');await page.locator('#text-run').click();await expect(page.locator('#text-operation-summary')).toContainText('No email addresses found');await expect(page.locator('#text-download')).toBeEnabled();expect((await downloadBytes(page,page.locator('#text-download'))).length).toBe(0);
 await page.locator('#text-input').fill('user@example.com');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('user@example.com');await expect(page.locator('#text-counts')).toContainText('Input:');await expect(page.locator('#text-output-counts')).toContainText('Output: 16 UTF-8 bytes');
 await page.locator('#text-input').fill('changed');await expect(page.locator('#text-operation-summary')).toContainText('Input or options changed');await expect(page.locator('#text-download')).toBeDisabled();
});

test('text newline summary describes actual download format and byte length',async({page})=>{
 await open(page,'text');await chooseTask(page,'text','newline');await page.locator('#text-input').fill('A\n中');await page.locator('#text-newline').selectOption('crlf');await page.locator('#text-run').click();await expect(page.locator('#text-operation-summary')).toContainText('CRLF');await expect(page.locator('#text-operation-summary')).toContainText('6 UTF-8 bytes');expect(await downloadBytes(page,page.locator('#text-download'))).toEqual(Buffer.from('A\r\n中'));
});

test('crop identifies saved and unsaved current edits and the full batch export',async({page})=>{
 await open(page,'images');await page.locator('#images-files').setInputFiles([png,{...png,name:'second.png'}]);await expect(page.locator('#images-queue .media-file-name')).toHaveCount(2);await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);
 await expect(page.locator('#images-crop-state')).toContainText('image.png has no saved crop');await expect(page.locator('#images-run')).toHaveText('Export 2 images · 0 saved crops');
 await page.locator('#images-rotate').click();await expect(page.locator('#images-crop-state')).toContainText('Unsaved crop changes for image.png');await expect(page.locator('#images-run')).toHaveText('Save current crop and export 2 images');await page.locator('#images-apply').click();await expect(page.locator('#images-crop-state')).toContainText('Saved crop for image.png');await expect(page.locator('#images-run')).toHaveText('Export 2 images · 1 saved crops');
 await page.locator('#images-queue .media-queue-row').nth(1).getByRole('button',{name:'Edit crop · second.png',exact:true}).click();await expect(page.locator('#images-crop-state')).toContainText('second.png has no saved crop');await page.locator('#images-run').click();await expect(page.locator('#images-result-info')).toContainText('2');await expect(page.locator('#images-output article')).toHaveCount(1);await expect(page.locator('#images-result-list .images-result-row')).toHaveCount(2);
});


test('text preview truncation preserves complete Unicode copy and download',async({page,context,browserName})=>{
 if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);await open(page,'text');await chooseTask(page,'text','replace');await page.locator('#text-input').fill('A'.repeat(1100)+'END-SENTINEL');await page.locator('#text-find').fill('A');await page.locator('#text-replacement').fill('中'.repeat(400));await page.locator('#text-run').click();await expect(page.locator('#text-result-note')).toContainText('Copy and download include the complete result');
 const expected='中'.repeat(440000)+'END-SENTINEL';expect(await page.locator('#text-result').inputValue()).not.toContain('END-SENTINEL');expect(await downloadBytes(page,page.locator('#text-download'))).toEqual(Buffer.from(expected));await page.locator('#text-copy').click();await expect.poll(async()=>(await page.evaluate(()=>navigator.clipboard.readText()))===expected).toBe(true);
});

test('crop selection label follows the selected image and clears outside crop task',async({page})=>{
 await open(page,'images');await page.locator('#images-files').setInputFiles([png,{...png,name:'second.png'}]);await expect(page.locator('#images-queue .media-file-name')).toHaveCount(2);await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);await expect(page.locator('#images-queue [aria-current=true]')).toContainText('image.png');await chooseTask(page,'images','compress');await expect(page.locator('#images-queue [aria-current=true]')).toHaveCount(0);
});

test('text empty newline result still names its export format and byte count',async({page})=>{
 await open(page,'text');await chooseTask(page,'text','newline');await page.locator('#text-newline').selectOption('crlf');await page.locator('#text-run').click();await expect(page.locator('#text-operation-summary')).toContainText('Completed with no output');await expect(page.locator('#text-operation-summary')).toContainText('CRLF');await expect(page.locator('#text-operation-summary')).toContainText('0 UTF-8 bytes');
});
