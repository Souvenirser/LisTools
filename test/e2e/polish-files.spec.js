import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import {createHash} from 'node:crypto';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});
async function download(page,id){const pending=page.waitForEvent('download');await page.locator(id).click();const file=await pending,chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);return {name:file.suggestedFilename(),bytes:Buffer.concat(chunks)};}
async function sourcePdf(){const pdf=await PDFDocument.create();[100,200,300].forEach(width=>pdf.addPage([width,400]));return Buffer.from(await pdf.save());}

test('text empty literal find identifies and focuses the repair field',async({page})=>{
 await page.goto('/text.html');await page.locator('#text-task-replace').click();await page.locator('#text-input').fill('hello');await page.locator('#text-run').click();
 await expect(page.locator('#text-find')).toBeFocused();await expect(page.locator('#text-find')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#text-find-error')).toBeVisible();
 await page.locator('#text-find').fill('hello');await expect(page.locator('#text-find')).not.toHaveAttribute('aria-invalid','true');
});

test('automatic text validation marks the find field without taking the input focus',async({page})=>{
 await page.goto('/text.html');await page.locator('#text-task-replace').click();await page.locator('#text-input').fill('typing');await expect(page.locator('#text-find-error')).toBeAttached();await expect(page.locator('#text-input')).toBeFocused();
});

test('text reuse threshold leaves complete copy and download intact',async({page,context,browserName})=>{
 if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);await page.goto('/text.html');await page.locator('#text-task-replace').click();
 await page.locator('#text-find').fill('x');const replacement='a'.repeat(256*1024);await page.locator('#text-replacement').fill(replacement);
 await expect(page.locator('#text-replacement')).toHaveValue(replacement);
 for(const size of [10*1024**2,10*1024**2+4]){
  const suffix=size===10*1024**2?'':'终!',value='a'.repeat(10*1024**2)+suffix;await page.locator('#text-input').fill('x'.repeat(40)+suffix);
  await page.locator('#text-run').click();await expect(page.locator('#text-download')).toBeEnabled();
  if(size===10*1024**2)await expect(page.locator('#text-use')).toBeEnabled();
  else{await expect(page.locator('#text-use')).toBeDisabled();await expect(page.locator('#text-use-reason')).toBeVisible();await expect(page.locator('#text-use')).toHaveAttribute('aria-describedby','text-use-reason');}
  const output=await download(page,'#text-download');expect(output.bytes.length).toBe(size);expect(createHash('sha256').update(output.bytes).digest('hex')).toBe(createHash('sha256').update(value).digest('hex'));
  await page.locator('#text-copy').click();await expect.poll(async()=>(await page.evaluate(()=>navigator.clipboard.readText()))===value).toBe(true);
 }
});

test('PDF page count is next to range, invalid range focuses, inspection preserves valid bytes',async({page})=>{
 await page.goto('/pdf.html');await page.locator('#pdf-task-extract').click();await page.locator('#pdf-files').setInputFiles({name:'中文 手册.pdf',mimeType:'application/pdf',buffer:await sourcePdf()});
 await expect(page.locator('#pdf-pages-field #pdf-inspect')).toBeVisible();await page.locator('#pdf-inspect').click();await expect(page.locator('#pdf-page-range')).toContainText('1–3');
 await page.locator('#pdf-pages').fill('4');await page.locator('#pdf-run').click();await expect(page.locator('#pdf-pages')).toBeFocused();await expect(page.locator('#pdf-pages-error')).toBeVisible();
 await page.locator('#pdf-pages').fill('3,1');await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();
 const before=await download(page,'#pdf-download');expect(before.name).toBe('中文 手册-extract.pdf');expect((await PDFDocument.load(before.bytes)).getPages().map(p=>p.getWidth())).toEqual([300,100]);
 await page.locator('#pdf-inspect').click();await expect(page.locator('#tool-status')).toContainText('Read 3 pages');expect((await download(page,'#pdf-download')).bytes).toEqual(before.bytes);
});

test('QR closed settings summarize and capacity recovery opens the existing correction control',async({page})=>{
 await page.goto('/qr.html');await page.locator('#qr-input').fill('a'.repeat(1400));await page.locator('#qr-level').evaluate(node=>{node.value='H';node.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#qr-generate').click();
 const details=page.locator('#qr-level').locator('xpath=ancestor::details');await expect(details).not.toHaveAttribute('open','');await expect(details.locator('summary')).toContainText('320');await expect(details.locator('summary')).toContainText('H');
 await expect(page.locator('#qr-capacity-recovery')).toBeVisible();await page.locator('#qr-capacity-recovery').click();await expect(details).toHaveAttribute('open','');await expect(page.locator('#qr-level')).toBeFocused();await expect(page.locator('#qr-level')).toHaveValue('H');await expect(page.locator('#qr-input')).toHaveValue('a'.repeat(1400));
 await page.locator('#qr-level').selectOption('L');await page.locator('#qr-generate').click();await expect(page.locator('#qr-svg')).toBeEnabled();await expect(page.locator('#qr-capacity-recovery')).toBeHidden();
});

test('QR recognition mode clears generation-only capacity recovery',async({page})=>{
 await page.goto('/qr.html');await page.locator('#qr-input').fill('a'.repeat(3000));await page.locator('#qr-generate').click();await expect(page.locator('#qr-capacity-recovery')).toBeVisible();await page.locator('#qr-task-recognize').click();await expect(page.locator('#qr-capacity-recovery')).toBeHidden();
});

for(const field of ['quality','target','width','height','scale'])test(`images ${field} errors identify and focus their exact field`,async({page})=>{
 await page.goto('/images.html');const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');await page.locator('#images-files').setInputFiles({name:'tiny.png',mimeType:'image/png',buffer:png});
 if(['width','height','scale'].includes(field))await page.locator('#images-task-resize').click();
 if(field==='quality')await page.locator('#images-format').selectOption('image/jpeg');
 if(field==='target')await page.locator('#images-compression-mode').selectOption('target');
 await page.locator(`#images-${field}`).fill(field==='scale'?'401':field==='target'?'0':field==='quality'?'101':'16385');await page.locator('#images-run').click();
 await expect(page.locator(`#images-${field}`)).toBeFocused();await expect(page.locator(`#images-${field}`)).toHaveAttribute('aria-invalid','true');await expect(page.locator(`#images-${field}-error`)).toBeVisible();
 await page.locator(`#images-${field}`).fill(field==='quality'?'80':field==='target'?'256':field==='scale'?'100':'0');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();
 const output=await download(page,'#images-download');expect(output.bytes.length).toBeGreaterThan(0);const dimensions=await page.locator('.images-preview-pair figure').nth(1).locator('img').evaluate(async img=>{await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const context=canvas.getContext('2d');context.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,pixel:[...context.getImageData(0,0,1,1).data]};});expect([dimensions.width,dimensions.height]).toEqual([1,1]);expect(dimensions.pixel).toHaveLength(4);expect(dimensions.pixel[3]).toBe(255);
});
