import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import {unzipSync} from 'fflate';
import {readFile,readdir,stat} from 'node:fs/promises';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});
async function pdf(name){const doc=await PDFDocument.create();doc.addPage([100,200]);return{name,mimeType:'application/pdf',buffer:Buffer.from(await doc.save())};}
async function downloaded(page,button){const pending=page.waitForEvent('download');await button.click();return readFile(await(await pending).path());}

test('password row visibility is independent and keeps the activated button focused',async({page})=>{
 await page.goto('/password.html');await page.locator('#password-batch').fill('3');await page.locator('#password-generate').click();
 const eye=page.locator('[data-password-visible="0"]');await eye.click();await expect(eye).toBeFocused();
 await page.locator('#password-show').click();await expect(page.locator('.password-result textarea[data-visible=true]')).toHaveCount(3);
 const second=page.locator('[data-password-visible="1"]');await second.click();await expect(second).toBeFocused();
 expect(await page.locator('.password-result textarea').evaluateAll(nodes=>nodes.map(n=>n.dataset.visible==='true'?'text':'password'))).toEqual(['text','password','text']);
 await page.keyboard.press('Enter');expect(await page.locator('.password-result textarea').evaluateAll(nodes=>nodes.map(n=>n.dataset.visible==='true'?'text':'password'))).toEqual(['text','text','text']);
});

test('PDF importing refuses a second batch explicitly and preserves the first batch',async({page})=>{
 await page.goto('/pdf.html');await page.evaluate(()=>{const native=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){await new Promise(r=>setTimeout(r,800));return native.call(this);};});
 const first=await pdf('first.pdf');await page.locator('#pdf-files').setInputFiles(first);await expect(page.locator('#pdf-choose')).toBeDisabled();
 await page.locator('#pdf-drop').evaluate(drop=>{const dt=new DataTransfer();dt.items.add(new File(['%PDF-1.4\n'],'second.pdf',{type:'application/pdf'}));drop.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));});
 await expect(page.locator('#tool-status')).toContainText('Reading');await expect(page.locator('#pdf-queue .media-file-name')).toHaveCount(1);await expect(page.locator('#pdf-queue')).toContainText('first.pdf');await expect(page.locator('#pdf-choose')).toBeEnabled();
 await page.locator('#pdf-files').setInputFiles(await pdf('second.pdf'));await expect(page.locator('#pdf-queue .media-file-name')).toHaveCount(2);
 await page.locator('#pdf-run').click();await expect(page.locator('#pdf-download')).toBeEnabled();const merged=await PDFDocument.load(await downloaded(page,page.locator('#pdf-download')));expect(merged.getPageCount()).toBe(2);
});

test('image cancellation preserves completed same-name files and a complete-only ZIP',async({page})=>{
 // Delay only the third real image operation; the first two run through the real Worker.
 const buffer=await readFile('public/icons/icon-128.png'),slowSize=buffer.length+4;await page.route(/\/(?:src\/tools\/images\/worker\.js|assets\/worker-[^/?]+\.js)/,async route=>{const response=await route.fetch();const body=`const readBlob=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){if(this.size===${slowSize})await new Promise(()=>{});return readBlob.call(this);};\n`+await response.text();await route.fulfill({response,body});});
 await page.addInitScript(()=>{const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.event==='progress')window.imageProgress=data.done;});}};});
 await page.goto('/images.html');await page.locator('#images-files').setInputFiles([0,1,2].map(index=>({name:'same.png',mimeType:'image/png',buffer:index===2?Buffer.concat([buffer,Buffer.from([0,1,2,3])]):buffer})));
 await page.locator('#images-run').click();await page.waitForFunction(()=>window.imageProgress===2);await expect(page.locator('.images-result-row')).toHaveCount(2,{timeout:1500});await expect(page.locator('.images-result-card')).toHaveCount(1);
 await page.locator('#images-cancel').click();await expect(page.locator('.images-result-row')).toHaveCount(2);await expect(page.locator('.images-result-card')).toHaveCount(1);const files=unzipSync(await downloaded(page,page.locator('#images-zip')));expect(Object.keys(files)).toEqual(['same.png','same-2.png']);for(const bytes of Object.values(files))expect(Array.from(bytes.slice(0,8))).toEqual([137,80,78,71,13,10,26,10]);
});

test('deduplicating an unchanged list retains its existing result and downloads',async({page})=>{
 await page.goto('/draw.html');await page.locator('#draw-input').fill('Alice\nBob');await page.locator('#draw-run').click();const before=await page.locator('#draw-result').textContent();await page.locator('#draw-dedupe').click();await expect(page.locator('#draw-result')).toHaveText(before);await expect(page.locator('#draw-txt')).toBeEnabled();
 await page.locator('#draw-input').fill('Alice\nBob\nAlice');await page.locator('#draw-run').click();await page.locator('#draw-dedupe').click();await expect(page.locator('#draw-txt')).toBeDisabled();
});

test('speed test network failure uses the selected language without upstream bilingual text',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('listools-language','de'));
 const chunks=await Promise.all((await readdir('dist/assets')).filter(name=>/^speedtest-.*\.js$/.test(name)).map(async name=>({name,size:(await stat('dist/assets/'+name)).size})));const sdk=chunks.sort((a,b)=>b.size-a.size)[0].name;await page.route(url=>url.pathname.endsWith('/assets/'+sdk)||/@cloudflare.*speedtest.*\.js/.test(url.pathname),route=>route.fulfill({contentType:'text/javascript',body:'export default class{play(){this.onError();}pause(){}}'}));
 await page.goto('/speedtest.html');await page.locator('#speed-start').click();await expect(page.locator('#speed-status')).toContainText('Netzwerkverbindung fehlgeschlagen');await expect(page.locator('#speed-status')).not.toContainText('公共');
});
