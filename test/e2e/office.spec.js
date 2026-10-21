import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('text imports UTF8, cleans lines, replaces literally and preserves forms across languages',async({page})=>{
 await page.goto('/text.html');
 await page.locator('#text-file').setInputFiles({name:'names.txt',mimeType:'text/plain',buffer:Buffer.from('beta\nalpha\nalpha\n')});
 await expect(page.locator('#text-input')).toHaveValue('beta\nalpha\nalpha\n');
 await page.locator('#text-run').click();
 await expect(page.locator('#text-result')).toHaveValue('beta\nalpha\n');
 await page.locator('#text-input').fill('a.a');
 await page.locator('#text-task-replace').click();
 await page.locator('#text-find').fill('.');await page.locator('#text-replacement').fill('$&');await page.locator('#text-run').click();
 await expect(page.locator('#text-result')).toHaveValue('a$&a');
 await selectLanguage(page,'zh-Hans');
 await expect(page.locator('#text-input')).toHaveValue('a.a');await expect(page.locator('#text-find')).toHaveValue('.');await expect(page.locator('#text-result')).toHaveValue('a$&a');
 await selectLanguage(page,'en');
 const download=page.waitForEvent('download');await page.locator('#text-download').click();expect((await download).suggestedFilename()).toBe('text-result.txt');
 await page.locator('#text-find').fill('');await expect(page.locator('#text-copy')).toBeDisabled();await page.locator('#text-run').click();await expect(page.locator('#tool-status')).toHaveClass(/is-error/);
});

test('text extraction is embedded, selective masking previews and cancel stays cancelled',async({page})=>{
 await page.goto('/text.html');
 await page.locator('#text-input').fill('mail a@example.com a@example.com phone 13812345678');
 await page.locator('#text-task-extract').click();await page.locator('#text-kind').selectOption('email');await page.locator('#text-run').click();
 await expect(page.locator('#text-result')).toHaveValue('a@example.com');
 await page.locator('#text-task-mask').click();await page.locator('#text-mask-email').uncheck();await page.locator('#text-run').click();
 await expect(page.locator('#text-result')).toHaveValue('mail a@example.com a@example.com phone 138****5678');
 await page.locator('#text-input').fill('a '.repeat(100000));await page.locator('#text-cancel').click();await page.waitForTimeout(450);await expect(page.locator('#tool-status')).toContainText(/cancelled/i);
});

test('QR creates Unicode PNG and SVG then recognizes the real generated image',async({page})=>{
 await page.goto('/qr.html');
 const text='Hello 世界 👋 https://example.com/a';await page.locator('#qr-input').fill(text);await page.locator('#qr-generate').click();
 await expect(page.locator('#qr-canvas')).toBeVisible();
 const image=await page.locator('#qr-canvas').screenshot();
 await page.locator('#qr-file').setInputFiles({name:'unicode.png',mimeType:'image/png',buffer:image});
 await expect(page.locator('#qr-result')).toHaveValue(text);
 await selectLanguage(page,'zh-Hans');await expect(page.locator('#qr-input')).toHaveValue(text);await expect(page.locator('#qr-result')).toHaveValue(text);
 const download=page.waitForEvent('download');await page.locator('#qr-task-generate').click();await page.locator('#qr-svg').click();expect((await download).suggestedFilename()).toBe('qrcode.svg');
 await page.locator('#qr-task-recognize').click();await page.locator('#qr-file').setInputFiles({name:'bad.gif',mimeType:'image/gif',buffer:Buffer.from('bad')});await expect(page.locator('#qr-result')).toHaveValue('');await expect(page.locator('#qr-copy')).toBeDisabled();
});

test('draw retains duplicate entries, creates balanced groups and handles inclusive integers',async({page})=>{
 await page.goto('/draw.html');await page.locator('#draw-input').fill('A\nA\nB\nC\nD');await page.locator('#draw-mode').selectOption('groups');await page.locator('#draw-count').fill('2');await page.locator('#draw-run').click();
 const result=page.locator('#draw-result');await expect(result).toContainText('Group 2');const groups=(await result.textContent()).split('\n\n');expect(groups.map(value=>value.split('\n').length-1)).toEqual([3,2]);expect((await result.textContent()).split('\n').filter(value=>value==='A')).toHaveLength(2);
 await selectLanguage(page,'zh-Hans');await expect(page.locator('#draw-input')).toHaveValue('A\nA\nB\nC\nD');
 await page.locator('#draw-min').fill('5');await page.locator('#draw-max').fill('5');await page.locator('#draw-number-count').fill('2');await page.locator('#draw-repeat').check();await page.locator('#draw-number-run').click();await expect(result).toHaveText('5\n5');
 await page.locator('#draw-repeat').uncheck();await page.locator('#draw-number-run').click();await expect(result).toHaveText('');await expect(page.locator('#draw-copy')).toBeDisabled();
});

test('countdown pauses, restores across reload and returns through navigation in the same tab',async({page})=>{
 await page.goto('/timer.html');await page.locator('#timer-duration').fill('20');await page.locator('#timer-duration').blur();await page.locator('#timer-start').click();await page.waitForTimeout(180);await page.locator('#timer-pause').click();
 const paused=await page.locator('#timer-display').textContent();await page.waitForTimeout(180);await expect(page.locator('#timer-display')).toHaveText(paused);
 await page.reload();await expect(page.locator('#timer-display')).toHaveText(paused);await page.locator('#timer-start').click();await page.waitForTimeout(150);await page.goto('/text.html');await page.goBack();await expect(page.locator('#timer-pause')).toBeEnabled();await page.locator('#timer-pause').click();expect(await page.locator('#timer-display').textContent()).not.toBe(paused);
});

test('stopwatch records lap splits, exports and preserves running elapsed state on reload',async({page})=>{
 await page.goto('/timer.html');await page.locator('#timer-mode').selectOption('stopwatch');await page.locator('#timer-start').click();await page.waitForTimeout(120);await page.locator('#timer-lap').click();await expect(page.locator('#timer-laps tr')).toHaveCount(1);await page.waitForTimeout(100);await page.reload();await expect(page.locator('#timer-mode')).toHaveValue('stopwatch');await expect(page.locator('#timer-laps tr')).toHaveCount(1);await expect(page.locator('#timer-pause')).toBeEnabled();await page.locator('#timer-pause').click();
 const value=await page.locator('#timer-display').textContent();await selectLanguage(page,'zh-Hans');await expect(page.locator('#timer-display')).toHaveText(value);
 const download=page.waitForEvent('download');await page.locator('#timer-export').click();expect((await download).suggestedFilename()).toBe('stopwatch-laps.txt');
});

for(const action of ['edit','clear','cancel'])test(`Use result discards delayed Blob text after ${action}`,async({page})=>{
 await page.goto('/text.html');await page.locator('#text-input').fill('old data');await page.locator('#text-advanced summary').click();await page.locator('#text-operation').selectOption('case');await page.locator('#text-case').selectOption('upper');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('OLD DATA');
 await page.evaluate(()=>{const original=Blob.prototype.text;Blob.prototype.text=async function(){const value=await original.call(this);await new Promise(resolve=>setTimeout(resolve,200));return value;};});
 await page.locator('#text-use').click();
 if(action==='edit')await page.locator('#text-input').fill('new unsaved text');
 else await page.locator(action==='clear'?'#text-clear':'#text-cancel').click();
 await page.waitForTimeout(350);
 await expect(page.locator('#text-input')).toHaveValue(action==='edit'?'new unsaved text':action==='clear'?'':'old data',{timeout:1000});
});

for(const bound of ['min','max'])test(`draw rejects an empty ${bound} instead of coercing it to zero`,async({page})=>{
 await page.goto('/draw.html');await page.locator('#draw-min').fill('0');await page.locator('#draw-max').fill('0');await page.locator(`#draw-${bound}`).fill('');await page.locator('#draw-number-run').click();
 await expect(page.locator('#tool-status')).toHaveClass(/is-error/,{timeout:1000});await expect(page.locator('#draw-result')).toHaveText('');await expect(page.locator('#draw-copy')).toBeDisabled();
});
