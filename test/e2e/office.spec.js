import {activeTool,evaluateTool,countdownDuration,chooseTask} from './task-helpers.js';
import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('text imports UTF8, cleans lines, replaces literally and preserves forms across languages',async({page})=>{
 await page.goto('/text.html');
 await activeTool(page).locator('#text-file').setInputFiles({name:'names.txt',mimeType:'text/plain',buffer:Buffer.from('beta\nalpha\nalpha\n')});
 await expect(activeTool(page).locator('#text-input')).toHaveValue('beta\nalpha\nalpha\n');
 await activeTool(page).locator('#text-run').click();
 await expect(activeTool(page).locator('#text-result')).toHaveValue('beta\nalpha\n');
 await activeTool(page).locator('#text-input').fill('a.a');
 await activeTool(page).locator('#text-task-replace').click();
 await activeTool(page).locator('#text-find').fill('.');await activeTool(page).locator('#text-replacement').fill('$&');await activeTool(page).locator('#text-run').click();
 await expect(activeTool(page).locator('#text-result')).toHaveValue('a$&a');
 await selectLanguage(page,'zh-Hans');
 await expect(activeTool(page).locator('#text-input')).toHaveValue('a.a');await expect(activeTool(page).locator('#text-find')).toHaveValue('.');await expect(activeTool(page).locator('#text-result')).toHaveValue('a$&a');
 await selectLanguage(page,'en');
 const download=page.waitForEvent('download');await activeTool(page).locator('#text-download').click();expect((await download).suggestedFilename()).toBe('text-result.txt');
 await activeTool(page).locator('#text-find').fill('');await expect(activeTool(page).locator('#text-copy')).toBeDisabled();await activeTool(page).locator('#text-run').click();await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);
});

test('text extraction is embedded, selective masking previews and cancel stays cancelled',async({page})=>{
 await page.goto('/text.html');
 await activeTool(page).locator('#text-input').fill('mail a@example.com a@example.com phone 13812345678');
 await activeTool(page).locator('#text-task-extract').click();await activeTool(page).locator('#text-kind').selectOption('email');await activeTool(page).locator('#text-run').click();
 await expect(activeTool(page).locator('#text-result')).toHaveValue('a@example.com');
 await activeTool(page).locator('#text-task-mask').click();await activeTool(page).locator('#text-mask-email').uncheck();await activeTool(page).locator('#text-run').click();
 await expect(activeTool(page).locator('#text-result')).toHaveValue('mail a@example.com a@example.com phone 138****5678');
 await activeTool(page).locator('#text-input').fill('a '.repeat(100000));await activeTool(page).locator('#text-cancel').click();await page.waitForTimeout(450);await expect(activeTool(page).locator('#tool-status')).toContainText(/cancelled/i);
});

test('QR creates Unicode PNG and SVG then recognizes the real generated image',async({page})=>{
 await page.goto('/qr.html');
 const text='Hello 世界 👋 https://example.com/a';await activeTool(page).locator('#qr-input').fill(text);await activeTool(page).locator('#qr-generate').click();
 await expect(activeTool(page).locator('#qr-canvas')).toBeVisible();
 const image=await activeTool(page).locator('#qr-canvas').screenshot();
 await activeTool(page).locator('#qr-file').setInputFiles({name:'unicode.png',mimeType:'image/png',buffer:image});
 await expect(activeTool(page).locator('#qr-result')).toHaveValue(text);
 await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#qr-input')).toHaveValue(text);await expect(activeTool(page).locator('#qr-result')).toHaveValue(text);
 const download=page.waitForEvent('download');await activeTool(page).locator('#qr-task-generate').click();await activeTool(page).locator('#qr-svg').click();expect((await download).suggestedFilename()).toBe('qrcode.svg');
 await activeTool(page).locator('#qr-task-recognize').click();await activeTool(page).locator('#qr-file').setInputFiles({name:'bad.gif',mimeType:'image/gif',buffer:Buffer.from('bad')});await expect(activeTool(page).locator('#qr-result')).toHaveValue(text);await expect(activeTool(page).locator('#qr-copy')).toBeEnabled();
});

test('draw retains duplicate entries, creates balanced groups and handles inclusive integers',async({page})=>{
 await page.goto('/draw.html');await activeTool(page).locator('#draw-input').fill('A\nA\nB\nC\nD');await activeTool(page).locator('#draw-mode').selectOption('groups');await activeTool(page).locator('#draw-count').fill('2');await activeTool(page).locator('#draw-run').click();
 const result=activeTool(page).locator('#draw-result');await expect(result).toContainText('Group 2');const groups=await result.locator('.draw-group p').allTextContents();expect(groups.map(value=>value.split('\n').length)).toEqual([3,2]);expect(groups.join('\n').split('\n').filter(value=>value==='A')).toHaveLength(2);
 await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#draw-input')).toHaveValue('A\nA\nB\nC\nD');
 await activeTool(page).locator('#draw-task-numbers').click();await activeTool(page).locator('#draw-min').fill('5');await activeTool(page).locator('#draw-max').fill('5');await activeTool(page).locator('#draw-number-count').fill('2');await activeTool(page).locator('#draw-repeat').check();await activeTool(page).locator('#draw-number-run').click();await expect(result).toHaveText('5\n5');
 await activeTool(page).locator('#draw-repeat').uncheck();await activeTool(page).locator('#draw-number-run').click();await expect(result).toHaveText('');await expect(activeTool(page).locator('#draw-copy')).toBeDisabled();
});

test('countdown pauses, restores across reload and returns through navigation in the same tab',async({page})=>{
 await page.goto('/timer.html');await countdownDuration(activeTool(page),20);await activeTool(page).locator('#timer-minutes').blur();await activeTool(page).locator('#timer-start').click();await page.waitForTimeout(180);await activeTool(page).locator('#timer-pause').click();
 const paused=await activeTool(page).locator('#timer-display').textContent();await page.waitForTimeout(180);await expect(activeTool(page).locator('#timer-display')).toHaveText(paused);
 await page.reload();await expect(activeTool(page).locator('#timer-display')).toHaveText(paused);await activeTool(page).locator('#timer-start').click();await page.waitForTimeout(150);await page.goto('/text.html');await page.goBack();await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await activeTool(page).locator('#timer-pause').click();expect(await activeTool(page).locator('#timer-display').textContent()).not.toBe(paused);
});

test('stopwatch records lap splits, exports and preserves running elapsed state on reload',async({page})=>{
 await page.goto('/timer.html');await activeTool(page).locator('#timer-task-stopwatch').click();await activeTool(page).locator('#timer-start').click();await page.waitForTimeout(120);await activeTool(page).locator('#timer-lap').click();await expect(activeTool(page).locator('#timer-laps tr')).toHaveCount(1);await page.waitForTimeout(100);await page.reload();await expect(activeTool(page).locator('#timer-mode')).toHaveValue('stopwatch');await expect(activeTool(page).locator('#timer-laps tr')).toHaveCount(1);await expect(activeTool(page).locator('#timer-pause')).toBeEnabled();await activeTool(page).locator('#timer-pause').click();
 const value=await activeTool(page).locator('#timer-display').textContent();await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#timer-display')).toHaveText(value);
 const download=page.waitForEvent('download');await activeTool(page).locator('#timer-export').click();expect((await download).suggestedFilename()).toBe('stopwatch-laps.txt');
});

for(const action of ['edit','clear','cancel'])test(`Use result discards delayed Blob text after ${action}`,async({page})=>{
 await page.goto('/text.html');await activeTool(page).locator('#text-input').fill('old data');await chooseTask(page,'text','case');await activeTool(page).locator('#text-case').selectOption('upper');await activeTool(page).locator('#text-run').click();await expect(activeTool(page).locator('#text-result')).toHaveValue('OLD DATA');
 await evaluateTool(page,()=>{const original=Blob.prototype.text;Blob.prototype.text=async function(){const value=await original.call(this);await new Promise(resolve=>setTimeout(resolve,200));return value;};});
 await activeTool(page).locator('#text-use').click();
 if(action==='edit')await activeTool(page).locator('#text-input').fill('new unsaved text');
 else await activeTool(page).locator(action==='clear'?'#text-clear':'#text-cancel').click();
 await page.waitForTimeout(350);
 await expect(activeTool(page).locator('#text-input')).toHaveValue(action==='edit'?'new unsaved text':action==='clear'?'':'old data',{timeout:1000});
});

for(const bound of ['min','max'])test(`draw rejects an empty ${bound} instead of coercing it to zero`,async({page})=>{
 await page.goto('/draw.html');await activeTool(page).locator('#draw-task-numbers').click();await activeTool(page).locator('#draw-min').fill('0');await activeTool(page).locator('#draw-max').fill('0');await activeTool(page).locator(`#draw-${bound}`).fill('');await activeTool(page).locator('#draw-number-run').click();
 await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/,{timeout:1000});await expect(activeTool(page).locator('#draw-result')).toHaveText('');await expect(activeTool(page).locator('#draw-copy')).toBeDisabled();
});
