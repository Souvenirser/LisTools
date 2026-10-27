import {test,expect} from '@playwright/test';

const file=(name,text='abc')=>({name,mimeType:'application/json',buffer:Buffer.from(text)});
async function download(page,id){const pending=page.waitForEvent('download');await page.locator(id).click();const stream=await(await pending).createReadStream(),parts=[];for await(const part of stream)parts.push(part);return Buffer.concat(parts).toString();}
test.beforeEach(async({page})=>{await page.addInitScript(()=>{
 localStorage.setItem('listools-language','en');
 const Native=Worker;window.heldMessages=[];window.Worker=class extends Native{
  postMessage(data,...args){this.md5=data.toolId==='md5';if(this.md5)window.failMd5Worker=this.fail;return super.postMessage(data,...args);}
  set onmessage(callback){super.onmessage=event=>{if(this.md5&&window.holdMd5)window.heldMessages.push({data:event.data,deliver:()=>callback(event)});else if(!this.md5&&window.holdJson)window.deliverJson=()=>callback(event);else callback(event);};}
  set onerror(callback){this.fail=()=>callback({preventDefault(){},message:'Controlled Worker failure'});super.onerror=callback;}
 };
 const read=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=function(){if(this instanceof File&&this.name==='slow.json')return new Promise((resolve,reject)=>{window.releaseRead=()=>read.call(this).then(resolve);window.rejectRead=()=>reject(new Error('Read failed'));});if(this instanceof File&&this.name==='unreadable.json')return Promise.reject(new Error('Read failed'));return read.call(this);};
});});
async function setupMd5(page,mode){await page.goto('/convert.html#md5');await page.locator('#md5-auto').uncheck();if(mode!=='text')await page.locator('#md5-mode').selectOption(mode);if(mode==='files')await page.locator('#md5-files').setInputFiles([file('first.txt'),file('second.txt','def')]);else await page.locator('#convert-source .cm-content').fill(mode==='lines'?'abc\ndef':'abc');if(mode==='hmac')await page.locator('#md5-key').fill('secret');await page.locator('#md5-run').click();await expect(page.locator('#md5-copy-all')).toBeEnabled();}
async function holdRun(page,mode){await page.evaluate(()=>{window.holdMd5=true;window.heldMessages=[];});await page.locator('#md5-run').click();await page.waitForFunction(()=>window.heldMessages.some(message=>message.data.status==='ready'));}
async function releaseFirst(page){await page.evaluate(()=>{for(const message of window.heldMessages.filter(message=>message.data.event&&((message.data.event==='item-complete'?message.data.item.id:message.data.itemId)==='0')))message.deliver();});}
for(const mode of ['text','lines','files','hmac'])test(`MD5 ${mode}: rerun isolates current completion and cancel before first item exports nothing`,async({page})=>{
 await setupMd5(page,mode);const display=mode==='files'?'[data-file-digest]':mode==='lines'?'#convert-result .cm-content':'#md5-value-hex32lower';const prior=await page.locator(display).first().evaluate(node=>node.value??node.textContent);await holdRun(page,mode);
 await expect(page.locator('#md5-copy-all')).toBeDisabled();if(['files','lines'].includes(mode)){await expect(page.locator('#md5-csv')).toBeDisabled();await expect(page.locator('#md5-json')).toBeDisabled();}
 expect(await page.locator(display).first().evaluate(node=>node.value??node.textContent)).toBe(prior);if(mode==='files'){await expect(page.locator('#md5-progress')).toHaveJSProperty('value',0);await expect(page.locator('#md5-file-rows button').first()).toBeDisabled();}
 await page.locator('#md5-cancel').click();await expect(page.locator('#md5-copy-all')).toBeDisabled();if(['files','lines'].includes(mode))await expect(page.locator('#md5-json')).toBeDisabled();
 await page.evaluate(()=>window.heldMessages.forEach(message=>message.deliver()));await expect(page.locator('#md5-copy-all')).toBeDisabled();await expect(page.locator('#md5-status')).toContainText(/cancelled/i);
});
for(const mode of ['lines','files'])test(`MD5 ${mode}: rerun cancel after first item exports only this batch's completed digest`,async({page})=>{
 await setupMd5(page,mode);await holdRun(page,mode);await releaseFirst(page);await expect(page.locator('#md5-copy-all')).toBeDisabled();if(mode==='files')await expect(page.locator('#md5-file-rows button').first()).toBeEnabled();await page.locator('#md5-cancel').click();await expect(page.locator('#md5-json')).toBeEnabled();const rows=JSON.parse(await download(page,'#md5-json')),ready=rows.filter(row=>row.status==='ready');expect(ready).toHaveLength(1);expect(ready[0].digest).toBe('900150983cd24fb0d6963f7d28e17f72');expect(rows.filter(row=>row.digest==='4ed9407630eb1000c0f6b63842defa7d3')).toHaveLength(0);expect(rows.length).toBeLessThanOrEqual(2);const csv=await download(page,'#md5-csv');expect(csv).toContain('900150983cd24fb0d6963f7d28e17f72');expect(csv).not.toContain('4ed9407630eb1000c0f6b63842defa7d3');
 await page.evaluate(()=>window.heldMessages.forEach(message=>message.deliver()));expect(JSON.parse(await download(page,'#md5-json'))).toEqual(rows);
});
for(const mode of ['files','text'])test(`MD5 ${mode}: cancelling destructive mode change preserves data and pending task`,async({page})=>{
 await setupMd5(page,mode);if(mode==='files')await page.locator('#md5-file-rows input').first().fill('900150983cd24fb0d6963f7d28e17f72');else await page.locator('#md5-expected').fill('900150983cd24fb0d6963f7d28e17f72');await holdRun(page,mode);
 let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});await page.locator('#md5-mode').selectOption('lines');expect(dialogs).toBe(1);await expect(page.locator('#md5-mode')).toHaveValue(mode);await expect(page.locator('#md5-mode')).toBeFocused();await expect(page.locator('#md5-cancel')).toBeEnabled();if(mode==='files'){await expect(page.locator('#md5-file-rows tr')).toHaveCount(2);await expect(page.locator('#md5-file-rows input').first()).toHaveValue('900150983cd24fb0d6963f7d28e17f72');}else await expect(page.locator('#md5-expected')).toHaveValue('900150983cd24fb0d6963f7d28e17f72');
});
async function setupJson(page){await page.goto('/index.html');await page.locator('#auto-format').uncheck();await page.locator('#source .cm-content').fill('{"keep":7}');await page.locator('#format').click();await expect(page.locator('.output-panel')).toHaveAttribute('data-status','ready');}
for(const action of ['cancel','edit','clear','replacement','pagehide'])test(`JSON late file read after ${action} cannot replace source or result`,async({page})=>{
 await setupJson(page);await page.locator('#file').setInputFiles(file('slow.json','{"late":1}'));await page.waitForFunction(()=>!!window.releaseRead);await expect(page.locator('#json-cancel')).toBeEnabled();await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#copy')).toBeDisabled();
 if(action==='cancel')await page.locator('#json-cancel').click();if(action==='edit')await page.locator('#source .cm-content').fill('{"edit":2}');if(action==='clear')await page.locator('#clear').click();if(action==='replacement'){await page.locator('#file').setInputFiles(file('next.json','{"next":3}'));await expect(page.locator('.output-panel')).toHaveAttribute('data-status','ready');}if(action==='pagehide')await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 const before=await page.locator('#source').evaluate(node=>node.value);await page.evaluate(()=>window.releaseRead());await expect.poll(()=>page.locator('#source').evaluate(node=>node.value)).toBe(before);await expect(page.locator('#json-import-status')).not.toContainText('Processing');await expect(page.locator('#json-cancel')).toBeDisabled();
});
for(const action of ['cancel','edit','clear','replacement','pagehide'])test(`JSON late file rejection after ${action} stays silent`,async({page})=>{
 await setupJson(page);await page.locator('#file').setInputFiles(file('slow.json'));await page.waitForFunction(()=>!!window.rejectRead);
 if(action==='cancel')await page.locator('#json-cancel').click();if(action==='edit')await page.locator('#source .cm-content').fill('{"edit":2}');if(action==='clear')await page.locator('#clear').click();if(action==='replacement')await page.locator('#file').setInputFiles(file('next.json','{"next":3}'));if(action==='pagehide')await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 await page.evaluate(()=>window.rejectRead());await expect(page.locator('#json-import-status')).not.toContainText(/Could not read|UTF-8/);await expect(page.locator('#json-cancel')).toBeDisabled();
});
test('JSON read failure and UTF8 decoding failure are distinct and preserve accepted source and result',async({page})=>{
 await setupJson(page);const before=await download(page,'#download');await page.locator('#file').setInputFiles(file('unreadable.json'));await expect(page.locator('#json-import-status')).toContainText('Could not read file: unreadable.json');await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#copy')).toBeEnabled();expect(await download(page,'#download')).toBe(before);
 await page.locator('#file').setInputFiles({...file('bad.json'),buffer:Buffer.from([255])});await expect(page.locator('#json-import-status')).toContainText('UTF-8');expect(await page.locator('#source').evaluate(node=>node.value)).toBe('{"keep":7}');expect(await download(page,'#download')).toBe(before);
 await page.locator('#file').setInputFiles(file('malformed.json','{"bad":}'));await expect(page.locator('.output-panel')).toHaveAttribute('data-status','error');await expect(page.locator('#error-detail')).toBeVisible();expect(await page.locator('#source').evaluate(node=>node.value)).toBe('{"bad":}');await expect(page.locator('#json-import-status')).toBeHidden();
});

for(const mode of ['text','hmac'])test(`MD5 ${mode}: cancel after this run's item retains only the current digest`,async({page})=>{
 await setupMd5(page,mode);await holdRun(page,mode);await releaseFirst(page);await expect(page.locator('#md5-copy-all')).toBeDisabled();await page.locator('#md5-cancel').click();await expect(page.locator('#md5-copy-all')).toBeEnabled();await expect(page.locator('#md5-value-hex32lower')).toHaveValue(mode==='text'?'900150983cd24fb0d6963f7d28e17f72':'dd2701993d29fdd0b032c233cec63403');if(mode==='hmac')await expect(page.locator('#md5-key')).toHaveValue('');
});
for(const mode of ['text','lines','files','hmac'])test(`MD5 ${mode}: worker error before current completion cannot export the old batch`,async({page})=>{
 await setupMd5(page,mode);await holdRun(page,mode);await page.evaluate(()=>window.failMd5Worker());await expect(page.locator('#md5-copy-all')).toBeDisabled();if(['files','lines'].includes(mode))await expect(page.locator('#md5-json')).toBeDisabled();await expect(page.locator('#md5-cancel')).toBeDisabled();await page.evaluate(()=>window.heldMessages.forEach(message=>message.deliver()));await expect(page.locator('#md5-copy-all')).toBeDisabled();
});
test('MD5 accepted mode change discards current queue and ignores its late messages',async({page})=>{
 await setupMd5(page,'files');await holdRun(page,'files');page.on('dialog',dialog=>dialog.accept());await page.locator('#md5-mode').selectOption('lines');await expect(page.locator('#md5-mode')).toHaveValue('lines');await expect(page.locator('#md5-file-rows tr')).toHaveCount(0);await expect(page.locator('#md5-copy-all')).toBeDisabled();await page.evaluate(()=>window.heldMessages.forEach(message=>message.deliver()));await expect(page.locator('#md5-copy-all')).toBeDisabled();
});
test('JSON cancel during file read also invalidates an earlier running parse',async({page})=>{
 await setupJson(page);await page.evaluate(()=>window.holdJson=true);await page.locator('#format').click();await page.waitForFunction(()=>!!window.deliverJson);await page.locator('#file').setInputFiles(file('slow.json','{"late":1}'));await page.waitForFunction(()=>!!window.releaseRead);await page.locator('#json-cancel').click();await page.evaluate(()=>{window.deliverJson();window.releaseRead();});await expect(page.locator('.output-panel')).toHaveAttribute('data-status','cancelled');await expect(page.locator('#copy')).toBeDisabled();expect(await page.locator('#source').evaluate(node=>node.value)).toBe('{"keep":7}');
});

test('JSON read cancellation keeps the accepted result and shows cancellation feedback',async({page})=>{
 await setupJson(page);await page.locator('#file').setInputFiles(file('slow.json'));await page.waitForFunction(()=>!!window.releaseRead);await page.locator('#json-cancel').click();await expect(page.locator('#json-import-status')).toContainText(/cancelled/i);await expect(page.locator('#editor')).toBeVisible();await expect(page.locator('#download')).toBeEnabled();expect(JSON.parse(await download(page,'#download'))).toEqual({keep:7});
});

test('MD5 superseded batch events cannot complete rows or advance the new batch progress',async({page})=>{
 await setupMd5(page,'files');await holdRun(page,'files');await page.evaluate(()=>window.supersededMessages=window.heldMessages);await holdRun(page,'files');await page.evaluate(()=>window.supersededMessages.forEach(message=>message.deliver()));await expect(page.locator('#md5-cancel')).toBeEnabled();await expect(page.locator('#md5-progress')).toHaveJSProperty('value',0);await expect(page.locator('#md5-file-rows button').first()).toBeDisabled();await expect(page.locator('#md5-copy-all')).toBeDisabled();await releaseFirst(page);await page.locator('#md5-cancel').click();expect(JSON.parse(await download(page,'#md5-json')).filter(row=>row.status==='ready')).toHaveLength(1);
});

test('JSON decoder runtime failure is not misreported as invalid UTF8',async({page})=>{
 await setupJson(page);await page.evaluate(()=>{const Native=TextDecoder;window.TextDecoder=class extends Native{decode(...args){throw new RangeError('String allocation failed');}};});await page.locator('#file').setInputFiles(file('runtime.json'));await expect(page.locator('#json-import-status')).toContainText('Could not read file: runtime.json');await expect(page.locator('#download')).toBeEnabled();expect(await page.locator('#source').evaluate(node=>node.value)).toBe('{"keep":7}');
});
