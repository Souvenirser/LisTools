import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
async function image(page,{width=200,height=100,type='image/png',noise=false}={}) {
  const bytes=await page.evaluate(async({width,height,type,noise})=>{
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
    if(noise){const pixels=ctx.createImageData(width,height);let n=12345;for(let i=0;i<pixels.data.length;i++){n=(n*1664525+1013904223)>>>0;pixels.data[i]=(i%4===3)?255:n>>>24;}ctx.putImageData(pixels,0,0);}else{ctx.fillStyle='red';ctx.fillRect(0,0,width/2,height);}
    return Array.from(new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,type))).arrayBuffer()));
  },{width,height,type,noise});return Buffer.from(bytes);
}
async function open(page,path){await page.goto(`/${path}.html`);await expect(page.locator(`#${path}-files`)).toBeAttached();await page.locator('#language').selectOption('en');}
async function getImageOutput(page){
  const output=await page.locator('.images-preview-pair figure').nth(1).locator('img').evaluate(async img=>{
    await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    return {width:canvas.width,height:canvas.height,pixel:Array.from(ctx.getImageData(canvas.width-2,2,1,1).data)};
  });
  return {...output,bytes:Array.from(await downloadBytes(page,page.locator('#images-output button').first()))};
}
test('image worker resizes, fills JPEG transparency, removes EXIF and preserves results through language change',async({page})=>{
  await open(page,'images');const buffer=await image(page);await page.locator('#images-files').setInputFiles([{name:'transparent.png',mimeType:'image/png',buffer}]);await expect(page.locator('#images-queue li')).toHaveCount(1);
  await page.locator('#images-task-resize').click();await page.locator('#images-width').fill('100');await page.locator('#images-format').selectOption('image/jpeg');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();
  const output=await getImageOutput(page);expect([output.width,output.height]).toEqual([100,50]);expect(output.pixel.slice(0,3).every(n=>n>245)).toBeTruthy();
  expect(Buffer.from(output.bytes).includes(Buffer.from('Exif'))).toBeFalsy();await page.locator('#language').selectOption('zh-Hans');await expect(page.locator('#images-results')).toBeVisible();expect(await page.locator('#images-width').inputValue()).toBe('100');expect(await page.locator('#images-queue li')).toHaveCount(1);
});
test('Cropper selection, rotation and flips are applied before resizing',async({page})=>{
  await open(page,'images');await page.locator('#images-files').setInputFiles([{name:'crop.png',mimeType:'image/png',buffer:await image(page)}]);await page.locator('#images-queue button').first().click();await expect(page.locator('cropper-selection')).toBeVisible();
  await page.waitForFunction(()=>{const image=document.querySelector('cropper-image');return image&&image.$getTransform()[0]>0;});
  await page.locator('#images-rotate').click();await page.locator('#images-flip-h').click();await page.locator('#images-flip-v').click();
  await page.locator('cropper-selection').evaluate(selection=>{const image=document.querySelector('cropper-image'),m=image.$getTransform(),scale=Math.hypot(m[0],m[1]);selection.$change(selection.x,selection.y,100*scale,50*scale,NaN);});
  await page.locator('#images-apply').click();await expect(page.locator('#tool-status')).toContainText('Crop saved');await page.locator('#images-task-resize').click();await page.locator('#images-scale').fill('50');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const output=await getImageOutput(page);expect([output.width,output.height]).toEqual([50,25]);
});
test('phone EXIF orientation is applied once and removed on output',async({page})=>{
  await open(page,'images');const jpeg=await image(page,{width:120,height:60,type:'image/jpeg'});
  const exif=Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000','hex');const buffer=Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]);
  await page.locator('#images-files').setInputFiles([{name:'phone.jpg',mimeType:'image/jpeg',buffer}]);await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const output=await getImageOutput(page);expect([output.width,output.height]).toEqual([60,120]);expect(Buffer.from(output.bytes).includes(Buffer.from('Exif'))).toBeFalsy();
});
test('unattainable target reports honestly without reducing resolution; cancellation and changed controls invalidate results',async({page})=>{
  await open(page,'images');await page.locator('#images-files').setInputFiles([{name:'noise.png',mimeType:'image/png',buffer:await image(page,{width:256,height:256,noise:true})}]);await page.locator('#images-advanced summary').click();await page.locator('#images-target').fill('1');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const output=await getImageOutput(page);expect([output.width,output.height]).toEqual([256,256]);await expect(page.locator('#images-output .tool-error')).toContainText('could not be reached');
  await page.locator('#images-quality').fill('70');await expect(page.locator('#images-results')).toBeHidden();await page.evaluate(()=>{document.querySelector('#images-run').click();document.querySelector('#images-cancel').click();});await expect(page.locator('#images-results')).toBeHidden();await expect(page.locator('#tool-status')).toContainText('cancelled');
});
async function pdf(widths){const doc=await PDFDocument.create();widths.forEach(w=>doc.addPage([w,200]));return Buffer.from(await doc.save());}
async function downloadBytes(page,button){const promise=page.waitForEvent('download');await button.click();const download=await promise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
test('PDF worker reads counts, reorders files, merges and splits downloadable real PDFs',async({page})=>{
  await open(page,'pdf');await page.locator('#pdf-files').setInputFiles([{name:'a.pdf',mimeType:'application/pdf',buffer:await pdf([100,150])},{name:'b.pdf',mimeType:'application/pdf',buffer:await pdf([300])}]);await page.locator('#pdf-inspect').click();await expect(page.locator('#tool-status')).toContainText('Read 3 pages');await page.locator('#pdf-queue li').nth(1).getByRole('button',{name:'Move up',exact:false}).click();await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();
  const merged=await PDFDocument.load(await downloadBytes(page,page.locator('#pdf-download')));expect(merged.getPages().map(p=>p.getWidth())).toEqual([300,100,150]);
  await page.locator('#language').selectOption('zh-Hans');await expect(page.locator('#pdf-result')).toBeVisible();await expect(page.locator('#pdf-queue li')).toHaveCount(2);
  await page.locator('#language').selectOption('en');await page.locator('#pdf-clear').click();await page.locator('#pdf-files').setInputFiles([{name:'split.pdf',mimeType:'application/pdf',buffer:await pdf([100,200])}]);await page.locator('#pdf-task-split').click();await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();const zip=unzipSync(await downloadBytes(page,page.locator('#pdf-download')));expect(Object.keys(zip)).toEqual(['page-1.pdf','page-2.pdf']);expect((await PDFDocument.load(zip['page-2.pdf'])).getPage(0).getWidth()).toBe(200);
});
test('PDF worker rejects invalid ranges and converts WebP images to A4 PDF',async({page})=>{
  await open(page,'pdf');await page.locator('#pdf-files').setInputFiles([{name:'a.pdf',mimeType:'application/pdf',buffer:await pdf([100,200])}]);await page.locator('#pdf-task-extract').click();await page.locator('#pdf-pages').fill('1,3');await page.locator('#pdf-run').click();await expect(page.locator('#tool-status')).toContainText('Invalid page selection');await expect(page.locator('#pdf-result')).toBeHidden();
  await page.locator('#pdf-clear').click();await page.locator('#pdf-task-images').click();await page.locator('#pdf-files').setInputFiles([{name:'a.webp',mimeType:'image/webp',buffer:await image(page,{type:'image/webp'})}]);await page.locator('#pdf-orientation').selectOption('landscape');await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();const doc=await PDFDocument.load(await downloadBytes(page,page.locator('#pdf-download')));expect(doc.getPageCount()).toBe(1);expect(doc.getPage(0).getWidth()).toBe(841.89);
});
test('image pan and zoom transform invalidates saved crop output and saves the new geometry',async({page})=>{
  await open(page,'images');await page.locator('#images-files').setInputFiles([{name:'transform.png',mimeType:'image/png',buffer:await image(page)}]);await expect(page.locator('#images-queue')).toContainText('transform.png');await page.locator('#images-queue button').first().click();
  await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);
  await page.locator('#images-apply').click();await expect(page.locator('#tool-status')).toContainText('Crop saved');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const original=await getImageOutput(page),oldUrl=await page.locator('.images-preview-pair figure').nth(1).locator('img').getAttribute('src');
  // Cropper's wheel interaction calls the same $zoom transform API.
  await page.locator('cropper-image').evaluate(img=>img.$zoom(.5));await expect(page.locator('#images-results')).toBeHidden();
  await page.locator('#images-apply').click();await expect(page.locator('#tool-status')).toContainText('Crop saved');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const zoomed=await getImageOutput(page);expect(zoomed.width).toBeLessThan(original.width);expect(zoomed.height).toBeLessThan(original.height);expect(await page.locator('.images-preview-pair figure').nth(1).locator('img').getAttribute('src')).not.toBe(oldUrl);
  // A subsequent pan must invalidate again, even though a crop is already saved.
  await page.locator('cropper-image').evaluate(img=>img.$move(30,0));await expect(page.locator('#images-results')).toBeHidden();await page.locator('#images-apply').click();await expect(page.locator('#tool-status')).toContainText('Crop saved');await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();const panned=await getImageOutput(page);expect([panned.width,panned.height]).toEqual([zoomed.width,zoomed.height]);expect(panned.bytes).not.toEqual(zoomed.bytes);
  // Processing also saves a changed draft, rather than reusing the previous saved crop.
  await page.locator('cropper-image').evaluate(img=>img.$move(-15,0));await expect(page.locator('#images-results')).toBeHidden();await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();expect((await getImageOutput(page)).bytes).not.toEqual(panned.bytes);
});
