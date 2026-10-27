import {test,expect} from '@playwright/test';
import {unzipSync} from 'fflate';
import {selectLanguage} from './language-helpers.js';
import {chooseTask} from './task-helpers.js';

async function image(page,{width=80,height=40,type='image/png',noise=false}={}){
  return Buffer.from(await page.evaluate(async({width,height,type,noise})=>{
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
    if(noise){const data=ctx.createImageData(width,height);let n=42;for(let i=0;i<data.data.length;i++){n=(n*1664525+1013904223)>>>0;data.data[i]=i%4===3?255:n>>>24;}ctx.putImageData(data,0,0);}else{ctx.fillStyle='red';ctx.fillRect(0,0,width,height);}
    return Array.from(new Uint8Array(await(await new Promise(resolve=>canvas.toBlob(resolve,type))).arrayBuffer()));
  },{width,height,type,noise}));
}
async function download(page,button){const pending=page.waitForEvent('download');await button.click();const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
async function source(page,value){await page.locator('#regex-source .cm-content').fill(value);}
async function runRegex(page){await page.locator('#regex-run').click();await expect(page.locator('#regex-status')).toHaveAttribute('data-task-state','ready');}

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});

test('same regex request retains active match, capture, selection and scroll; changed requests reset',async({page})=>{
  await page.goto('/regex.html');await page.locator('#regex-pattern').fill('(?<word>item)');await source(page,Array.from({length:70},(_,i)=>`item ${i}`).join('\n'));await runRegex(page);
  await page.locator('#regex-next').click();await page.locator('#regex-next').click();await expect(page.locator('#regex-current')).toContainText('3');
  const selected=await page.locator('#regex-source .cm-content').evaluate(()=>getSelection().toString());const scroll=await page.locator('#regex-source .cm-scroller').evaluate(node=>node.scrollTop);
  await runRegex(page);await expect(page.locator('#regex-current')).toHaveText('Match 3 / 70');await expect(page.locator('#regex-match-rows [aria-current]')).toHaveText('3');expect(await page.locator('#regex-source .cm-scroller').evaluate(node=>node.scrollTop)).toBe(scroll);expect(await page.locator('#regex-source .cm-content').evaluate(()=>getSelection().toString())).toBe(selected);
  await source(page,'item changed\nitem next');await expect(page.locator('#regex-current')).toHaveText('Match 1 / 2');
});

test('regex request identity includes pattern, flags, task, replacement and extraction group',async({page})=>{
  await page.goto('/regex.html');await page.locator('#regex-pattern').fill('(?<word>item)');await source(page,'item item item');await runRegex(page);
  async function second(){await page.locator('#regex-next').click();await expect(page.locator('#regex-current')).toHaveText('Match 2 / 3');}
  async function first(){await runRegex(page);await expect(page.locator('#regex-current')).toHaveText('Match 1 / 3');}
  await second();await page.locator('#regex-pattern').fill('(?<word>item|never)');await first();
  await second();await page.locator('#regex-common-flags input[value="i"]').check();await first();
  await second();await chooseTask(page,'regex','extract');await first();await page.locator('#regex-group').selectOption('name:word');await first();
  await second();await runRegex(page);await expect(page.locator('#regex-current')).toHaveText('Match 2 / 3');await expect(page.locator('#regex-group')).toHaveValue('name:word');
  await page.locator('#regex-next').click();await page.locator('#regex-group').selectOption('0');await first();
  await chooseTask(page,'regex','replace');await first();await second();await page.locator('#regex-replacement .cm-content').fill('updated');await first();
  await second();await runRegex(page);await expect(page.locator('#regex-current')).toHaveText('Match 2 / 3');await expect(page.locator('#regex-output .cm-content')).toHaveText('updated updated updated');
});

test('regex popup and match states use legible dark theme tokens including zero-width markers',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'})));await page.goto('/regex.html');await page.locator('#regex-rules-open').click();
  const palette=await page.locator('#regex-rules-panel').evaluate(node=>{const cs=getComputedStyle(node),input=getComputedStyle(node.querySelector('input'));return {bg:cs.backgroundColor,surface:cs.getPropertyValue('--surface').trim(),inputBg:input.backgroundColor,inputColor:input.color};});
  expect(palette.bg).not.toBe('rgb(255, 255, 255)');expect(palette.inputBg).not.toBe('rgb(255, 255, 255)');expect(palette.inputBg).not.toBe(palette.inputColor);await page.keyboard.press('Escape');
  await page.locator('#regex-pattern').fill('item|(?=x)');await source(page,'item item x x');await runRegex(page);
  const styles=await page.locator('#regex-source').evaluate(node=>{
    const current=getComputedStyle(node.querySelector('.regex-match.regex-selected')),regular=getComputedStyle(node.querySelector('.regex-match:not(.regex-selected)')),empty=getComputedStyle(node.querySelector('.regex-empty-match'));
    function luminance(value){const channels=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
    function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
    return {current:current.backgroundColor,regular:regular.backgroundColor,currentContrast:contrast(current.color,current.backgroundColor),regularContrast:contrast(regular.color,regular.backgroundColor),marker:empty.borderInlineStartColor,markerContrast:contrast(empty.borderInlineStartColor,getComputedStyle(node.querySelector('.cm-editor')).backgroundColor)};
  });expect(styles.current).not.toBe(styles.regular);expect(styles.currentContrast).toBeGreaterThanOrEqual(4.5);expect(styles.regularContrast).toBeGreaterThanOrEqual(4.5);expect(styles.markerContrast).toBeGreaterThanOrEqual(3);await page.locator('#regex-next').click();await page.locator('#regex-next').click();await expect(page.locator('.regex-empty-match.regex-selected')).toHaveCount(1);
});

test('image batch keeps one full comparison, a bounded selectable list, and real downloadable outputs',async({page})=>{
  await page.goto('/images.html');const buffer=await image(page);await page.locator('#images-files').setInputFiles(Array.from({length:30},(_,i)=>({name:`batch-${i}.png`,mimeType:'image/png',buffer})));await expect(page.locator('#images-queue li')).toHaveCount(30);await page.locator('#images-format').selectOption('image/jpeg');await page.locator('#images-run').click();await expect(page.locator('#tool-status')).toContainText('Processed 30 images.');await expect(page.locator('.images-preview-pair')).toHaveCount(1);await expect(page.locator('.images-result-row')).toHaveCount(30);
  const bounds=await page.locator('#images-result-list').evaluate(node=>({client:node.clientHeight,scroll:node.scrollHeight}));expect(bounds.client).toBeLessThanOrEqual(360);expect(bounds.scroll).toBeGreaterThan(bounds.client);
  await page.locator('.images-result-row').nth(25).getByRole('button',{name:/Preview/}).click();await expect(page.locator('.images-result-card h3')).toHaveText('batch-25.jpg');const decoded=await page.locator('.images-preview-pair img').nth(1).evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight];});expect(decoded).toEqual([80,40]);
  const zip=unzipSync(await download(page,page.locator('#images-zip')));expect(Object.keys(zip)).toHaveLength(30);expect(Array.from(zip['batch-25.jpg'].slice(0,2))).toEqual([255,216]);
  const hash=await page.evaluate(()=>location.hash);await page.locator('#images-adjust-parameters').click();expect(await page.evaluate(()=>location.hash)).toBe(hash);await expect(page.locator('#images-settings > h2')).toBeFocused();await page.locator('#images-add-images').click();expect(await page.evaluate(()=>location.hash)).toBe(hash);await expect(page.locator('#images-choose')).toBeFocused();await expect(page.locator('.images-result-card h3')).toHaveText('batch-25.jpg');
});

test('image growth remains downloadable and explicitly reports no reduction',async({page})=>{
  await page.goto('/images.html');const buffer=await image(page,{width:1,height:1});await page.locator('#images-files').setInputFiles({name:'tiny.png',mimeType:'image/png',buffer});await page.locator('#images-format').selectOption('image/jpeg');await page.locator('#images-run').click();await expect(page.locator('.images-size-change')).toContainText(/File size increased by [\d.]+%; no size reduction/);const bytes=await download(page,page.locator('#images-download'));expect(bytes.length).toBeGreaterThan(buffer.length);expect(bytes.subarray(0,2)).toEqual(Buffer.from([255,216]));
});

test('image outcomes distinguish unchanged and smaller outputs from unmet targets',async({page})=>{
  await page.goto('/images.html');const buffer=await image(page);await page.locator('#images-files').setInputFiles({name:'same.png',mimeType:'image/png',buffer});await page.locator('#images-run').click();await expect(page.locator('.images-size-change')).toHaveText('File size unchanged; no size reduction');expect((await download(page,page.locator('#images-download'))).length).toBe(buffer.length);
  await page.locator('#images-queue-details > summary').click();await page.locator('#images-clear').click();const noise=await image(page,{width:256,height:128,noise:true});await page.locator('#images-files').setInputFiles({name:'noise.png',mimeType:'image/png',buffer:noise});await page.locator('#images-format').selectOption('image/jpeg');await page.locator('#images-quality').fill('20');await page.locator('#images-run').click();await expect(page.locator('.images-size-change')).toContainText(/File size reduced by [\d.]+%/);const smaller=await download(page,page.locator('#images-download'));expect(smaller.length).toBeLessThan(noise.length);expect(Array.from(smaller.subarray(0,2))).toEqual([255,216]);
  await page.locator('#images-format').selectOption('image/png');await page.locator('#images-compression-mode').selectOption('target');await page.locator('#images-target').fill('1');await page.locator('#images-run').click();await expect(page.locator('#images-output .tool-warning')).toContainText('could not be reached');const decoded=await page.locator('.images-preview-pair img').nth(1).evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight];});expect(decoded).toEqual([256,128]);
});

test('cancelled image batches retain completed duplicate names, file identity and a complete-only real ZIP',async({page})=>{
  await page.goto('/images.html');const first=await image(page),second=await image(page,{width:160,height:90}),slowSize=first.length+4;
  await page.route(/\/(?:src\/tools\/images\/worker\.js|assets\/worker-[^/?]+\.js)/,async route=>{const response=await route.fetch();await route.fulfill({response,body:`const readBlob=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){if(this.size===${slowSize})await new Promise(()=>{});return readBlob.call(this);};\n`+await response.text()});});
  await page.evaluate(()=>{const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.event==='progress')window.imageProgress=data.done;});}};});
  await page.locator('#images-files').setInputFiles([first,second,Buffer.concat([first,Buffer.from([0,1,2,3])])].map(buffer=>({name:'same.png',mimeType:'image/png',buffer})));await page.locator('#images-run').click();await page.waitForFunction(()=>window.imageProgress===2);await expect(page.locator('.images-result-row')).toHaveCount(2);await expect(page.locator('.images-preview-pair')).toHaveCount(1);await page.locator('#images-cancel').click();await expect(page.locator('#tool-status')).toContainText('cancelled');await expect(page.locator('.images-result-row')).toHaveCount(2);
  await page.locator('.images-result-row').nth(1).getByRole('button',{name:'Preview same-2.png',exact:true}).click();for(const img of await page.locator('.images-preview-pair img').all())expect(await img.evaluate(async node=>{await node.decode();return [node.naturalWidth,node.naturalHeight];})).toEqual([160,90]);
  const zip=unzipSync(await download(page,page.locator('#images-zip')));expect(Object.keys(zip)).toEqual(['same.png','same-2.png']);for(const [index,bytes]of Object.values(zip).entries())expect(await page.evaluate(async bytes=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));const size=[bitmap.width,bitmap.height];bitmap.close();return size;},Array.from(bytes))).toEqual(index?[160,90]:[80,40]);
});

test('password row toggle names include their row and preserve independent visibility',async({page})=>{
  await page.goto('/password.html');await page.locator('#password-batch').fill('3');await page.locator('#password-length').fill('256');await page.locator('#password-generate').click();const toggles=page.locator('[data-password-visible]');for(let i=0;i<3;i++)await expect(toggles.nth(i)).toHaveAccessibleName(`Show results · ${i+1}`);await toggles.nth(1).click();await expect(toggles.nth(1)).toHaveAccessibleName('Hide results · 2');expect(await page.locator('.password-result input').evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['password','text','password']);
  for(const row of await page.locator('.password-result').all())expect(await row.evaluate(node=>node.querySelector('.password-result-actions').getBoundingClientRect().bottom<=node.querySelector('input').getBoundingClientRect().top)).toBe(true);
});

test('all eight speed metrics use explicit translation keys and update when language changes',async({page})=>{
  await page.goto('/speedtest.html');const metrics=page.locator('[data-metric]');await expect(metrics).toHaveCount(8);const keys=await metrics.locator('.tool-note').evaluateAll(nodes=>nodes.map(node=>node.dataset.i18n));expect(keys).toEqual(['downloadBps','uploadBps','latencyMs','jitterMs','downloadLatencyMs','downloadJitterMs','uploadLatencyMs','uploadJitterMs'].map(key=>`usability.speedtest.${key}`));await selectLanguage(page,'zh-Hans');await expect(page.locator('[data-metric="downloadLatencyMs"] .tool-note')).toHaveText('下载负载延迟');await selectLanguage(page,'en');await expect(page.locator('[data-metric="downloadLatencyMs"] .tool-note')).toHaveText('Download loaded latency');
});
