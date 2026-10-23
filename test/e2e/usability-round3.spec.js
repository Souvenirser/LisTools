import {chooseTask} from './task-helpers.js';
import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {selectLanguage} from './language-helpers.js';

async function open(page,tool){await page.goto(`/${tool}.html`);await selectLanguage(page,'en');}
const file=(name,text='keep')=>({name,mimeType:'application/octet-stream',buffer:Buffer.from(text)});
async function md5Files(page,files){await open(page,'convert');await page.locator('#convert-tool-list a[href="#md5"]').click();await page.locator('#md5-mode').selectOption('files');await page.locator('#md5-files').setInputFiles(files);}

test('T1 rejected MD5 batch preserves completed digest and expected value',async({page})=>{
 await md5Files(page,[file('keep.bin')]);await page.locator('#md5-run').click();
 await expect(page.locator('[data-file-digest]')).toHaveValue('18ccf61d533b600bbf5a963359223fe4');
 await page.locator('#md5-file-rows input:not([readonly])').fill('18ccf61d533b600bbf5a963359223fe4');
 await page.locator('#md5-files').setInputFiles(Array.from({length:101},(_,i)=>file(`${i}.bin`)));
 await expect(page.locator('#md5-file-rows')).toContainText('keep.bin');
 await expect(page.locator('[data-file-digest]')).toHaveValue('18ccf61d533b600bbf5a963359223fe4');
 await expect(page.locator('[data-file-match]')).toHaveAttribute('data-match','match');
 await expect(page.locator('#md5-json')).toBeEnabled();
});
test('T1 MD5 single raw file is carried to conversion and completed queue survives return',async({page})=>{
 const bytes=Buffer.from([0,255,128,13,10]);await md5Files(page,[{...file('raw.bin'),buffer:bytes}]);await page.locator('#md5-run').click();
 const digest=createHash('md5').update(bytes).digest('hex');await expect(page.locator('[data-file-digest]')).toHaveValue(digest);
 await page.locator('#md5-file-rows input:not([readonly])').fill(digest);
 await page.locator('#convert-tool-list a[href="#base64"]').click();await expect(page.locator('#input-mode')).toHaveValue('file');await expect(page.locator('#convert-input-info')).toContainText('raw.bin');
 await page.locator('#convert-run').click();await expect(page.locator('#convert-result .cm-content')).toHaveText('AP+ADQo=');
 await page.locator('#convert-tool-list a[href="#md5"]').click();await expect(page.locator('[data-file-digest]')).toHaveValue(digest);await expect(page.locator('[data-file-match]')).toHaveAttribute('data-match','match');
});
test('T1 multiple and oversized MD5 files block ordinary conversion without losing queue',async({page})=>{
 await md5Files(page,[file('one.bin'),file('two.bin')]);await page.locator('#convert-tool-list a[href="#base64"]').click();await expect(page.locator('#convert-run')).toBeDisabled();await expect(page.locator('#convert-source .cm-content')).toHaveText('');
 await page.locator('#convert-tool-list a[href="#md5"]').click();await expect(page.locator('#md5-file-rows tr')).toHaveCount(2);
 await page.locator('#md5-files').evaluate(input=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array(50*1024*1024+1)],'large.bin'));input.files=data.files;input.dispatchEvent(new Event('change'));});
 await page.locator('#convert-tool-list a[href="#base64"]').click();await expect(page.locator('#convert-run')).toBeDisabled();await page.locator('#convert-tool-list a[href="#md5"]').click();await expect(page.locator('#md5-file-rows')).toContainText('large.bin');
});

async function downloadBytes(page,button){const pending=page.waitForEvent('download');await button.click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
test('T2 invalid UTF8 and oversized text import preserve input, counts and downloadable result',async({page})=>{
 await open(page,'text');await page.locator('#text-input').fill('one\none\ntwo');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('one\ntwo');
 const counts=await page.locator('#text-counts').textContent();await page.locator('#text-file').setInputFiles({...file('bad.txt'),buffer:Buffer.from([255])});await expect(page.locator('#tool-status')).toHaveClass(/is-error/);
 await expect(page.locator('#text-input')).toHaveValue('one\none\ntwo');await expect(page.locator('#text-result')).toHaveValue('one\ntwo');await expect(page.locator('#text-counts')).toHaveText(counts);expect((await downloadBytes(page,page.locator('#text-download'))).toString()).toBe('one\ntwo');
 await page.locator('#text-file').evaluate(input=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array(10*1024*1024+1)],'big.txt'));input.files=data.files;input.dispatchEvent(new Event('change'));});await expect(page.locator('#text-result')).toHaveValue('one\ntwo');await expect(page.locator('#text-download')).toBeEnabled();
});
test('T2 rejected and empty PDF batches preserve queue and actual download',async({page})=>{
 await open(page,'pdf');await page.locator('#pdf-example').click();await expect(page.locator('#pdf-result')).toBeVisible();const queue=await page.locator('#pdf-queue').textContent(),bytes=await downloadBytes(page,page.locator('#pdf-download'));
 await page.locator('#pdf-drop').dispatchEvent('drop',{dataTransfer:await page.evaluateHandle(()=>new DataTransfer())});await expect(page.locator('#pdf-result')).toBeVisible();
 await page.locator('#pdf-files').setInputFiles(Array.from({length:101},(_,i)=>file(`${i}.pdf`)));await expect(page.locator('#pdf-queue')).toHaveText(queue);expect(await downloadBytes(page,page.locator('#pdf-download'))).toEqual(bytes);
});
test('T2 all rejected images keep old output while mixed imports accept successful files',async({page})=>{
 await open(page,'images');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();const output=page.locator('#images-output button').first(),bytes=await downloadBytes(page,output);
 await page.locator('#images-files').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')});await expect(page.locator('#images-queue .is-error')).toContainText('broken.png');await expect(page.locator('#images-results')).toBeVisible();expect(await downloadBytes(page,output)).toEqual(bytes);
 await page.locator('#images-files').setInputFiles([{name:'good.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')},{name:'bad.png',mimeType:'image/png',buffer:Buffer.from('bad')}]);await expect(page.locator('#images-queue')).toContainText('good.png');await expect(page.locator('#images-queue .media-file-name').filter({hasText:'bad.png'})).toHaveCount(0);await expect(page.locator('#images-results')).toBeHidden();
});
test('T2 QR rejects empty, unsupported and corrupt images without clearing a recognized result',async({page})=>{
 await open(page,'qr');await page.locator('#qr-input').fill('keep qr');await page.locator('#qr-generate').click();await expect(page.locator('#qr-canvas')).toBeVisible();const image=await page.locator('#qr-canvas').screenshot();await page.locator('#qr-file').setInputFiles({name:'good.png',mimeType:'image/png',buffer:image});await expect(page.locator('#qr-result')).toHaveValue('keep qr');
 const url=await page.locator('#qr-source-image').getAttribute('src');await page.locator('#qr-drop').dispatchEvent('drop',{dataTransfer:await page.evaluateHandle(()=>new DataTransfer())});
 for(const type of ['image/gif','image/png']){await page.locator('#qr-file').setInputFiles({name:'bad.png',mimeType:type,buffer:Buffer.from('bad')});await expect(page.locator('#tool-status')).toHaveClass(/is-error/);await expect(page.locator('#qr-result')).toHaveValue('keep qr');await expect(page.locator('#qr-source-image')).toHaveAttribute('src',url);await expect(page.locator('#qr-copy')).toBeEnabled();}
});
for(const action of ['cancel','edit','clear','replace'])test(`T3 text read can be ${action} and late completion cannot overwrite current input`,async({page})=>{
 await page.addInitScript(()=>{const original=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){if(this instanceof File&&this.name==='slow.txt')await new Promise(resolve=>window.releaseTextRead=resolve);const value=await original.call(this);if(this instanceof File&&this.name==='slow.txt')window.textReadFinished=true;return value;};});
 await open(page,'text');await page.locator('#text-input').fill('old\nold');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('old');await page.locator('#text-file').setInputFiles(file('slow.txt','late'));
 await page.waitForFunction(()=>Boolean(window.releaseTextRead));await expect(page.locator('#text-cancel')).toBeEnabled();await expect(page.locator('#tool-status')).toContainText(/reading|import/i);await expect(page.locator('#text-result')).toHaveValue('old');
 if(action==='cancel')await page.locator('#text-cancel').click();else if(action==='edit')await page.locator('#text-input').fill('edited');else if(action==='clear')await page.locator('#text-clear').click();else await page.locator('#text-file').setInputFiles(file('new.txt','new'));
 await page.evaluate(()=>window.releaseTextRead());await page.waitForFunction(()=>window.textReadFinished);await expect(page.locator('#text-input')).toHaveValue({cancel:'old\nold',edit:'edited',clear:'',replace:'new'}[action]);await expect(page.locator('#text-run')).toBeEnabled();
 if(action==='cancel')await expect(page.locator('#text-result')).toHaveValue('old');
});
test('T7 text import is a native button accessible with Enter and Space',async({page,browserName})=>{
 await open(page,'text');const button=page.getByRole('button',{name:'Import TXT',exact:true});await page.locator('#text-input').focus();for(let i=0;i<8&&!(await button.evaluate(node=>node===document.activeElement));i++)await page.keyboard.press(browserName==='webkit'?'Alt+Tab':'Tab');await expect(button).toBeFocused();for(const key of ['Enter','Space']){const chooser=page.waitForEvent('filechooser');await page.keyboard.press(key);await(await chooser).setFiles(file('keyboard.txt','keyboard'));await expect(page.locator('#text-input')).toHaveValue('keyboard');}
});

for(const width of [390,1440])test(`T9 crop editor is immediately usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});await open(page,'images');await page.locator('#images-files').setInputFiles('public/icons/icon-128.png');await expect(page.locator('#images-queue')).toContainText('icon-128.png');await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);
 const visible=await page.locator('#images-crop-container').evaluate(node=>{const box=node.getBoundingClientRect(),bar=document.querySelector('.workspace-action-fixed')?.getBoundingClientRect();return Math.min(box.bottom,bar?.top??innerHeight)-Math.max(box.top,0);});expect(visible).toBeGreaterThanOrEqual(120);
 await expect(page.locator('#images-crop-panel').locator('xpath=..')).toHaveClass(/workspace-input/);
});
test('T8 real keyboard moves or resizes only a focused crop selection and queue edit activates crop task',async({page})=>{
 await open(page,'images');await page.locator('#images-files').setInputFiles('public/icons/icon-128.png');await expect(page.locator('#images-queue')).toContainText('icon-128.png');await page.locator('#images-queue button').first().click();await expect(page.locator('#images-task-crop')).toHaveAttribute('aria-pressed','true');
 const selection=page.locator('cropper-selection');await expect(selection).toBeFocused();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(selection).toBeFocused();const before=await selection.evaluate(node=>({x:node.x,width:node.width}));await page.keyboard.press('ArrowRight');await expect.poll(()=>selection.evaluate(node=>node.x)).toBeCloseTo(before.x+1);await page.keyboard.press('Shift+ArrowRight');await expect.poll(()=>selection.evaluate(node=>node.width)).toBeCloseTo(before.width+1);
 const x=await selection.evaluate(node=>node.x);await page.locator('#images-ratio').focus();await page.keyboard.press('ArrowDown');await expect(selection).not.toBeFocused();expect(await selection.evaluate(node=>node.x)).toBeCloseTo(x);await page.locator('#images-rotate').focus();await page.keyboard.press('ArrowRight');expect(await selection.evaluate(node=>node.x)).toBeCloseTo(x);
});
test('T10 extract describes the current rule and task switching keeps custom expressions',async({page})=>{
 await open(page,'regex');await expect(page.locator('#regex-task-extract')).toHaveText('Extract matches');await page.locator('#regex-pattern').fill('ORDER-\\d+');await page.locator('#regex-task-extract').click();await expect(page.locator('#regex-pattern')).toHaveValue('ORDER-\\d+');await expect(page.locator('#regex-operation')).not.toBeVisible();
});
test('T11 narrow regex shows source editor and fixed toolbars contain only primary actions',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'regex');const visible=await page.locator('#regex-source').evaluate(node=>{const rect=node.getBoundingClientRect(),bar=document.querySelector('.workspace-action-fixed')?.getBoundingClientRect();return Math.min(rect.bottom,bar?.top??innerHeight)-Math.max(rect.top,0);});expect(visible).toBeGreaterThanOrEqual(120);await expect(page.locator('.workspace-action-fixed #regex-auto')).toHaveCount(0);
 await open(page,'text');await expect(page.locator('.workspace-action-fixed #text-import')).toHaveCount(0);await expect(page.locator('#text-import')).toBeVisible();await open(page,'qr');await expect(page.locator('.workspace-action-fixed #qr-png')).toHaveCount(0);await expect(page.locator('#qr-output-panel #qr-png')).toHaveCount(1);
});
for(const [width,lang] of [[320,'en'],[320,'de'],[390,'de']])test(`T11 regex keeps input visible with ${lang} labels at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page,'regex');await selectLanguage(page,lang);const visible=await page.locator('#regex-source').evaluate(node=>{const box=node.getBoundingClientRect(),bar=document.querySelector('.workspace-action-fixed').getBoundingClientRect();return Math.min(box.bottom,bar.top)-Math.max(box.top,72);});expect(visible).toBeGreaterThanOrEqual(120);
});
test('Review MD5 text edits in another converter invalidate cached digest',async({page})=>{
 await open(page,'convert');await page.locator('#convert-tool-list a[href="#md5"]').click();await page.locator('#md5-auto').uncheck();await page.locator('#convert-source .cm-content').fill('abc');await page.locator('#md5-run').click();await expect(page.locator('#md5-value-hex32lower')).toHaveValue('900150983cd24fb0d6963f7d28e17f72');await page.locator('#convert-tool-list a[href="#base64"]').click();await expect(page.locator('#md5-controls')).toBeHidden();await page.locator('#convert-source .cm-content').fill('xyz');await page.locator('#convert-tool-list a[href="#md5"]').click();await expect(page.locator('#md5-value-hex32lower')).toHaveValue('');await expect(page.locator('#md5-copy-all')).toBeDisabled();await page.locator('#md5-run').click();await expect(page.locator('#md5-value-hex32lower')).toHaveValue('d16fb36f0911f878998c136191af705e');
});
test('Review MD5 lines restore their own result after another conversion used the editor',async({page})=>{
 await open(page,'convert');await page.locator('#convert-tool-list a[href="#md5"]').click();await page.locator('#md5-mode').selectOption('lines');await page.locator('#convert-source .cm-content').fill('abc\ndef');await page.locator('#md5-run').click();await expect(page.locator('#convert-result .cm-content')).toContainText('900150983cd24fb0d6963f7d28e17f72');const result=await page.locator('#convert-result .cm-content').textContent();await page.locator('#convert-tool-list a[href="#base64"]').click();await page.locator('#convert-run').click();await expect(page.locator('#convert-result .cm-content')).toHaveText('YWJjCmRlZg==');await page.locator('#convert-tool-list a[href="#md5"]').click();await expect(page.locator('#convert-result .cm-content')).toHaveText(result);await expect(page.locator('#md5-json')).toBeEnabled();
});
for(const action of ['cancel','replace'])test(`T3 late text read failure after ${action} cannot overwrite the current state`,async({page})=>{
 await page.addInitScript(()=>{const original=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=function(){if(this instanceof File&&this.name==='slow.txt')return new Promise((resolve,reject)=>window.failTextRead=()=>reject(new Error('late read failure')));return original.call(this);};});await open(page,'text');await page.locator('#text-input').fill('old\nold');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('old');await page.locator('#text-file').setInputFiles(file('slow.txt'));await page.waitForFunction(()=>Boolean(window.failTextRead));
 if(action==='cancel')await page.locator('#text-cancel').click();else await page.locator('#text-file').setInputFiles(file('new.txt','\uFEFFnew\r\ntext'));
 await page.evaluate(()=>window.failTextRead());await expect(page.locator('#text-input')).toHaveValue(action==='cancel'?'old\nold':'new\ntext');await expect(page.locator('#tool-status')).not.toHaveClass(/is-error/);await expect(page.locator('#text-run')).toBeEnabled();if(action==='cancel'){await expect(page.locator('#text-result')).toHaveValue('old');await expect(page.locator('#tool-status')).toContainText(/cancelled/i);}
});
