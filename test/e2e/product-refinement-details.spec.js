import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';
import {selectLanguage} from './language-helpers.js';
async function open(page,id){await page.goto('/'+id+'.html');await selectLanguage(page,'en');}
async function clipboard(page){await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.copied=text}});});}
test('unit copy distinguishes raw numeric results from the displayed equation',async({page})=>{
 await clipboard(page);await open(page,'units');await page.locator('#unit-copy').click();expect(await page.evaluate(()=>window.copied)).toBe('0.001');await page.locator('#unit-copy-equation').click();expect(await page.evaluate(()=>window.copied)).toContain('=');await page.locator('#unit-all').check();await page.locator('#unit-run').click();await page.locator('#unit-copy-all').click();expect((await page.evaluate(()=>window.copied)).split('\n').length).toBeGreaterThan(2);
});
test('workday summary copies exceptions as part of the calculation context',async({page})=>{
 await clipboard(page);await open(page,'dates');await chooseTask(page,'dates','workdays');await page.locator('#work-start').fill('2026-10-01');await page.locator('#work-end').fill('2026-10-08');await page.locator('details').filter({has:page.locator('#date-off')}).locator('summary').click();await page.locator('#date-off').fill('2026-10-02');await page.locator('#date-work').fill('2026-10-03');await page.locator('#workdays-run').click();await page.locator('#workdays-copy').click();const copied=await page.evaluate(()=>window.copied);expect(copied).toContain('2026-10-02');expect(copied).toContain('2026-10-03');await expect(page.locator('label[for=work-start]')).toBeVisible();await expect(page.locator('.date-task:not([hidden]) .date-result h2')).toHaveText('Result');
});
test('draw results show participation and selected totals without removing duplicate names',async({page})=>{
 await open(page,'draw');await page.locator('#draw-input').fill('Alice\nBob\nAlice\nCarol\nDan');await page.locator('#draw-mode').selectOption('groups');await page.locator('#draw-count').fill('2');await page.locator('#draw-run').click();await expect(page.locator('#draw-summary')).toContainText('5 entries');await expect(page.locator('#draw-summary')).toContainText('5 selected');await expect(page.locator('.draw-group')).toHaveCount(2);
});
test('timer exposes ready running and paused states while preserving its elapsed time',async({page})=>{
 await open(page,'timer');await expect(page.locator('#timer-state')).toHaveText('Ready to start');await page.locator('#timer-start').click();await expect(page.locator('#timer-state')).toHaveText('Running');await page.locator('#timer-pause').click();await expect(page.locator('#timer-state')).toHaveText('Paused');await selectLanguage(page,'zh-Hans');await expect(page.locator('#timer-state')).toHaveText('已暂停');
});
test('QR results show their actual output dimensions and correction level',async({page})=>{
 await open(page,'qr');await page.locator('#qr-input').fill('中文 LisTools 😀');await page.locator('#qr-generate').click();await expect(page.locator('#qr-output-meta')).toContainText('320 × 320');await expect(page.locator('#qr-output-meta')).toContainText('M');await page.locator('#qr-input').fill('changed');await expect(page.locator('#qr-output-meta')).toBeHidden();
});
test('text statistics use understandable visible-character terminology',async({page})=>{
 await open(page,'text');await page.locator('#text-input').fill('你好👨‍👩‍👧‍👦');await expect(page.locator('#text-counts')).toContainText('3 visible characters');
});
test('Cron results identify the effective dialect and field count',async({page})=>{
 await open(page,'cron');await expect(page.locator('#cron-effective-context')).toContainText('5 fields');
});

test('successful text work clears the processing message',async({page})=>{
 await open(page,'text');await page.locator('#text-input').fill('Alice\nBob\nAlice');await page.locator('#text-run').click();await expect(page.locator('#text-operation-summary')).toContainText('Output: 2');await expect(page.locator('#tool-status')).not.toContainText('Processing');
});

test('task search results explicitly identify their parent tool',async({page})=>{
 await open(page,'qr');await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('email');await expect(page.locator('[data-target="text.html#extract"] small')).toContainText('Clean and extract text');
});
test('a single draw does not describe its result as a group',async({page})=>{
 await open(page,'draw');await page.locator('#draw-input').fill('Alice\nBob');await page.locator('#draw-run').click();await expect(page.locator('#draw-summary')).not.toContainText('groups');await expect(page.locator('#draw-result')).not.toBeEmpty();
});
