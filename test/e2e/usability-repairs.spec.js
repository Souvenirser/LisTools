import {tryExample} from './task-helpers.js';
import {countdownDuration,chooseTask} from './task-helpers.js';
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { selectLanguage } from './language-helpers.js';

async function open(page,tool){await page.goto(`/${tool}.html`);await selectLanguage(page,'en');}
async function outputSize(page){return page.locator('.images-preview-pair figure').nth(1).locator('img').evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight];});}

const byteCases=[['empty',Buffer.alloc(0)],['binary',Buffer.from([0,255,128,0,13,10])],['bom',Buffer.from('\uFEFF你好')],['crlf',Buffer.from('a\r\nb\r\n')],['below-preview',Buffer.alloc(1024*1024-1,97)],['at-preview',Buffer.alloc(1024*1024,97)],['above-preview',Buffer.alloc(1024*1024+1,97)],['different-tail',Buffer.concat([Buffer.alloc(1024*1024,97),Buffer.from('b')])]];
for(const [name,buffer]of byteCases)test(`B1 raw file bytes: ${name}`,async({page})=>{
  await open(page,'convert');await page.locator('#convert-file').setInputFiles({name:`${name}.bin`,mimeType:'application/octet-stream',buffer});
  await page.locator('#convert-tool-list a[href="#md5"]').click();await page.locator('#md5-run').click();
  await expect(page.locator('#md5-file-rows [data-file-digest]')).toHaveValue(createHash('md5').update(buffer).digest('hex'));
  await expect(page.locator('#md5-file-rows td').nth(1)).toHaveText(String(buffer.length));
});

test('B1 conversion file handoff hashes all bytes and preserves file mode on return',async({page})=>{
  await open(page,'convert');
  const buffer=Buffer.from('a'.repeat(1024*1024)+'tail changes the digest');
  await page.locator('#convert-file').setInputFiles({name:'whole.txt',mimeType:'text/plain',buffer});
  await expect(page.locator('#convert-input-info')).toContainText('whole.txt');
  await page.locator('#convert-tool-list a[href="#md5"]').click();
  await page.locator('#md5-run').click();
  await expect(page.locator('#md5-file-rows [data-file-digest]')).toHaveValue(createHash('md5').update(buffer).digest('hex'));
  await expect(page.locator('#md5-file-rows')).toContainText('whole.txt');
  await page.locator('#convert-tool-list a[href="#base64"]').click();
  await expect(page.locator('#input-mode')).toHaveValue('file');
  await expect(page.locator('#convert-input-info')).toContainText('whole.txt');
  await page.locator('#convert-tool-list a[href="#md5"]').click();
  await expect(page.locator('#md5-mode')).toHaveValue('files');
  await page.locator('#md5-run').click();
  await expect(page.locator('#md5-file-rows [data-file-digest]')).toHaveValue(createHash('md5').update(buffer).digest('hex'));
});

for(const tool of ['text','images','pdf','qr','regex'])test(`B2 ${tool} example cancellation preserves content and results`,async({page})=>{
  await open(page,tool);
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  // Empty pages run directly; the second click would overwrite the first example.
  await tryExample(page,tool);
  if(tool==='text')await expect(page.locator('#text-result')).not.toHaveValue('');
  if(tool==='images')await expect(page.locator('#images-results')).toBeVisible();
  if(tool==='pdf')await expect(page.locator('#pdf-result')).toBeVisible();
  if(tool==='qr')await expect(page.locator('#qr-canvas')).toBeVisible();
  if(tool==='regex')await expect(page.locator('#regex-status')).toContainText('2 matches');
  expect(dialogs).toBe(0);
  const before=await page.locator('#tool-root, .regex-layout').first().evaluate(el=>({text:el.textContent,values:Array.from(el.querySelectorAll('input,textarea')).map(input=>input.value)}));
  await tryExample(page,tool);
  expect(dialogs).toBe(1);
  const after=await page.locator('#tool-root, .regex-layout').first().evaluate(el=>({text:el.textContent,values:Array.from(el.querySelectorAll('input,textarea')).map(input=>input.value)}));
  expect(after).toEqual(before);
});

test('B2 own PDF is retained on dismiss and replaced only after accepting',async({page})=>{
  await open(page,'pdf');const doc=await PDFDocument.create();doc.addPage([123,200]);
  await page.locator('#pdf-files').setInputFiles({name:'original.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
  await page.locator('#pdf-run').click();await expect(page.locator('#pdf-result')).toBeVisible();
  const old=await page.locator('#pdf-result').textContent();
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#pdf-example').click();
  await expect(page.locator('#pdf-queue')).toContainText('original.pdf');await expect(page.locator('#pdf-result')).toHaveText(old);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#pdf-example').click();
  await expect(page.locator('#pdf-queue')).not.toContainText('original.pdf');await expect(page.locator('#pdf-result')).toBeVisible();
});

test('B2 auxiliary text fields are protected even when main input is empty',async({page})=>{
  await open(page,'text');await page.locator('#text-task-replace').click();await page.locator('#text-find').fill('private find');await page.locator('#text-replacement').fill('private replacement');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});await page.locator('#text-example').click();
  expect(dialogs).toBe(1);await expect(page.locator('#text-find')).toHaveValue('private find');await expect(page.locator('#text-replacement')).toHaveValue('private replacement');await expect(page.locator('#text-input')).toHaveValue('');await expect(page.locator('#text-example-note')).toBeHidden();
});
test('B2 custom regex fields are protected with empty source and auto-run disabled',async({page})=>{
  await open(page,'regex');await page.locator('#regex-auto').locator('xpath=ancestor::details').locator('summary').click();await page.locator('#regex-auto').uncheck();await page.locator('#regex-pattern').fill('private\\d+');await page.locator('#regex-flags').fill('im');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});await tryExample(page,'regex');
  expect(dialogs).toBe(1);await expect(page.locator('#regex-pattern')).toHaveValue('private\\d+');await expect(page.locator('#regex-flags')).toHaveValue('im');await expect(page.locator('#regex-source .cm-content')).toHaveText('');await expect(page.locator('#regex-example-note')).toBeHidden();
});

test('B3 format keeps input size and resize settings return independently',async({page})=>{
  await open(page,'images');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();
  await chooseTask(page,'images','resize');await page.locator('#images-width').fill('120');await page.locator('#images-run').click();
  await expect(page.locator('#images-results')).toBeVisible();expect(await outputSize(page)).toEqual([120,80]);
  await chooseTask(page,'images','format');await page.locator('#images-format').selectOption('image/png');await page.locator('#images-run').click();
  await expect(page.locator('#images-results')).toBeVisible();expect(await outputSize(page)).toEqual([1200,800]);
  await chooseTask(page,'images','resize');await expect(page.locator('#images-width')).toHaveValue('120');
  await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();expect(await outputSize(page)).toEqual([120,80]);
});

async function delayedImage(page){
  await page.addInitScript(()=>{const original=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){const slow=this instanceof File&&this.name==='slow.png';if(slow)await new Promise(resolve=>window.releaseImageRead=resolve);const bytes=await original.call(this);if(slow)window.imageReadFinished=true;return bytes;};});
  await open(page,'images');await page.locator('#images-files').setInputFiles('public/icons/icon-128.png');
  await expect(page.locator('#images-queue')).toContainText('icon-128.png');
  await page.locator('#images-files').setInputFiles({name:'slow.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});
  await page.waitForFunction(()=>Boolean(window.releaseImageRead));
}
test('B4 settings and task changes retain a pending import with visible busy state',async({page})=>{
  await delayedImage(page);await page.locator('#images-format').selectOption('image/jpeg');await page.locator('#images-quality').fill('70');await chooseTask(page,'images','format');
  await expect(page.locator('#images-run')).toBeDisabled();await expect(page.locator('#tool-status')).toBeVisible();
  await page.evaluate(()=>window.releaseImageRead());await expect(page.locator('#images-queue')).toContainText('slow.png');await expect(page.locator('#images-run')).toBeEnabled();
});
for(const action of ['clear','cancel'])test(`B4 ${action} prevents late imports from restoring the queue`,async({page})=>{
  await delayedImage(page);await page.locator(`#images-${action}`).click();await page.evaluate(()=>window.releaseImageRead());
  await page.waitForFunction(()=>window.imageReadFinished);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#images-queue')).not.toContainText('slow.png');
  if(action==='clear')await expect(page.locator('#images-queue')).not.toContainText('icon-128.png');
  await expect(page.locator('#images-run'))[action==='clear'?'toBeDisabled':'toBeEnabled']();
});

test('B5 locale change does not replace an in-flight text job with statistics',async({page})=>{
  await page.addInitScript(()=>{const NativeWorker=Worker;window.textOperations=[];window.Worker=class extends NativeWorker{postMessage(data,...args){if(data.operation)window.textOperations.push(data.operation);return super.postMessage(data,...args);}set onmessage(callback){super.onmessage=event=>{if(event.data.status==='ready'&&window.textOperations.at(-1)==='lines')window.deliverText=()=>callback(event);else callback(event);};}};});
  await open(page,'text');await page.locator('#text-input').fill('beta\nbeta\nalpha');await page.locator('#text-run').click();
  await page.waitForFunction(()=>Boolean(window.deliverText));const before=await page.evaluate(()=>window.textOperations.length);
  await selectLanguage(page,'zh-Hant');await page.evaluate(()=>window.deliverText());
  expect(await page.evaluate(()=>window.textOperations.length)).toBe(before);await expect(page.locator('#text-result')).toHaveValue('beta\nalpha');
});

test('B6 edited source invalidates draw output and exports, unrelated fields and locale do not',async({page})=>{
  await open(page,'draw');await page.locator('#draw-input').fill('Alice');await page.locator('#draw-run').click();await expect(page.locator('#draw-result')).toHaveText('Alice');
  await page.locator('#draw-min').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});await selectLanguage(page,'ar');await expect(page.locator('#draw-copy')).toBeEnabled();
  await page.locator('#draw-input').fill('Bob');await expect(page.locator('#draw-result')).toBeEmpty();
  for(const id of ['copy','txt','csv'])await expect(page.locator(`#draw-${id}`)).toBeDisabled();
  await page.locator('#draw-task-numbers').click();await page.locator('#draw-number-run').click();await expect(page.locator('#draw-copy')).toBeEnabled();
  await page.locator('#draw-input').evaluate(el=>{el.value='Charlie';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#draw-copy')).toBeEnabled();
  await page.locator('#draw-repeat').check();await expect(page.locator('#draw-copy')).toBeDisabled();
});

test('B7 countdown expiry is handled once while viewing the running stopwatch',async({page})=>{
  await page.clock.install();await open(page,'timer');await page.clock.pauseAt(new Date(Date.now()+10000));
  await page.evaluate(()=>{window.expiryMessages=0;const target=document.querySelector('#tool-status');new MutationObserver(()=>{if(target.textContent==='Countdown complete.')window.expiryMessages++;}).observe(target,{childList:true});});
  await countdownDuration(page,1);await page.locator('#timer-start').click();await page.locator('#timer-task-stopwatch').click();await page.locator('#timer-start').click();
  await page.clock.runFor(1500);await expect(page.locator('#tool-status')).toContainText('complete');
  const count=await page.evaluate(()=>window.expiryMessages);expect(count).toBe(1);await page.locator('#timer-task-countdown').click();await page.clock.runFor(500);expect(await page.evaluate(()=>window.expiryMessages)).toBe(count);
  await expect(page.locator('#timer-display')).toHaveText('00:00:00.000');await page.locator('#timer-task-stopwatch').click();await expect(page.locator('#timer-display')).not.toHaveText('00:00:00.000');
});

test('B7 editing duration then clicking Start starts the countdown on the first click',async({page})=>{
  await open(page,'timer');await countdownDuration(page,30);await page.locator('#timer-start').click();
  await expect(page.locator('#timer-pause')).toBeEnabled();
});

test('B8 standard keys chain full result, start fresh numbers and apply unary to result',async({page})=>{
  await open(page,'calculator');await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');
  for(const key of ['*','4','equals'])await page.locator(`[data-key="${key}"]`).click();await expect(page.locator('#result')).toHaveText('20');
  for(const key of ['+','2','equals'])await page.locator(`[data-key="${key}"]`).click();await expect(page.locator('#result')).toHaveText('22');
  await page.locator('[data-key="square"]').click();await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('484');
  await page.locator('[data-key="."]').click();await page.locator('[data-key="5"]').click();await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('0.5');
  await page.locator('#calc-mode-scientific').click();await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');
  for(const key of ['*','4','equals'])await page.locator(`[data-key="${key}"]`).click();await expect(page.locator('#result')).toHaveText('14');
});

test('B4 repeat import waits and pagehide rejects a late read',async({page})=>{
  await delayedImage(page);await page.locator('#images-files').setInputFiles({name:'second.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});
  await expect(page.locator('#tool-status')).toContainText('please wait');
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));window.releaseImageRead();});
  await page.waitForFunction(()=>window.imageReadFinished);await expect(page.locator('#images-queue')).not.toContainText('slow.png');await expect(page.locator('#images-queue')).not.toContainText('second.png');
});

for(const [source,id]of [['list','mode'],['list','count'],['list','dedupe'],['numbers','min'],['numbers','max'],['numbers','number-count']])test(`B6 ${id} invalidates only its result source`,async({page})=>{
  await open(page,'draw');await page.locator('#draw-input').fill('Alice\nAlice\nBob');await page.locator('#draw-task-'+source).click();await page.locator(source==='list'?'#draw-run':'#draw-number-run').click();await expect(page.locator('#draw-copy')).toBeEnabled();
  if(id==='mode')await page.locator('#draw-mode').selectOption('shuffle');else if(id==='dedupe')await page.locator('#draw-dedupe').click();else await page.locator(`#draw-${id}`).fill('2');
  await expect(page.locator('#draw-copy')).toBeDisabled();await expect(page.locator('#draw-txt')).toBeDisabled();await expect(page.locator('#draw-csv')).toBeDisabled();
});

test('B8 exact precision, percent, negate, direct editing and selected text keep their semantics',async({page})=>{
  await open(page,'calculator');await page.locator('#expression').fill('123456789012345678901234567890+1');await page.locator('#calculate').click();await expect(page.locator('#copy')).toBeEnabled();
  await page.locator('[data-key="-"]').click();
  for(const key of '123456789012345678901234567890')await page.locator(`[data-key="${key}"]`).click();
  await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('1');
  await page.locator('[data-key="%"]:visible').click();await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('0.01');
  await page.locator('[data-key="negate"]').click();await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('-0.01');
  await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');
  await page.locator('#expression').fill('7+1');await page.locator('[data-key="*"]').click();await page.locator('[data-key="2"]').click();await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('9');
  await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');
  await page.locator('#expression').evaluate(input=>input.setSelectionRange(0,1));await page.locator('[data-key="4"]').click();await expect(page.locator('#expression')).toHaveValue('4+3');
});
