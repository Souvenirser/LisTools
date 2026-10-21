import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('removed low-value tools are absent from navigation and search',async({page})=>{
 await page.goto('/text.html');await page.locator('button.brand').click();
 for(const name of ['interview','experience','salary']){await page.locator('#tool-menu-search').fill(name);await expect(page.locator(`#tool-menu a[data-target="${name}.html"]`)).toHaveCount(0);}
 await page.locator('#tool-menu-search').fill('');await expect(page.locator('#tool-menu summary').filter({hasText:/Recruiting helpers|招聘助手/})).toHaveCount(0);
});
test('text task examples demonstrate deduplication and extraction without writing patterns',async({page})=>{
 await page.goto('/text.html');await page.locator('#text-example').click();await expect(page.locator('#text-result')).toHaveValue('Alice\nBob\nCharlie');
 await page.locator('#text-task-extract').click();await page.locator('#text-example').click();await expect(page.locator('#text-result')).toHaveValue('alice@example.com\nbob@example.com');
 await selectLanguage(page,'ar');await expect(page.locator('#text-result')).toHaveValue('alice@example.com\nbob@example.com');await expect(page.locator('#text-task-extract')).toHaveAttribute('aria-pressed','true');
});
test('PDF example generates a real merged download and can switch to a page extraction task',async({page})=>{
 await page.goto('/pdf.html');await page.locator('#pdf-example').click();await expect(page.locator('#pdf-result')).toBeVisible();await expect(page.locator('#pdf-queue li')).toHaveCount(2);
 await page.locator('#pdf-task-extract').click();await page.locator('#pdf-example').click();await expect(page.locator('#pdf-result')).toBeVisible();await expect(page.locator('#pdf-queue li')).toHaveCount(1);await expect(page.locator('#pdf-pages')).toHaveValue('1-2');await expect(page.locator('#pdf-output-order')).toContainText('1, 2');
});
test('image example produces output while advanced dimensions stay collapsed by default',async({page})=>{
 await page.goto('/images.html');await expect(page.locator('#images-advanced')).not.toHaveAttribute('open','');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();
 await page.locator('#images-task-resize').click();await expect(page.locator('#images-advanced')).toHaveAttribute('open','');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();await expect(page.locator('#images-width')).toHaveValue('800');
});
test('QR examples demonstrate both creating a code and reading its image',async({page})=>{
 await page.goto('/qr.html');await page.locator('#qr-example').click();await expect(page.locator('#qr-canvas')).toBeVisible();await expect(page.locator('#qr-input')).toHaveValue('https://example.com');
 await page.locator('#qr-task-recognize').click();await page.locator('#qr-example').click();await expect(page.locator('#qr-result')).toHaveValue('https://example.com');await expect(page.locator('#qr-source-image')).toBeVisible();
});
test('developer regex example explains extraction with actual order numbers',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-example').click();await expect(page.locator('#regex-output .cm-content')).toHaveText('ORDER-1024ORDER-2048');await expect(page.locator('#regex-operation')).toHaveValue('extract');
});
test('choosing the regex task preserves the original user text',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-source .cm-content').fill('My order: ORDER-7777');await page.locator('#regex-task-extract').click();
 await expect(page.locator('#regex-source .cm-content')).toHaveText('My order: ORDER-7777');await expect(page.locator('#regex-output .cm-content')).toHaveText('ORDER-7777');
});
test('regex example resets old capture selection before using a capture-free pattern',async({page})=>{
 await page.goto('/regex.html');await page.locator('#regex-pattern').fill('(ORDER-\\d+)');await page.locator('#regex-source .cm-content').fill('ORDER-9');await page.locator('#regex-operation').selectOption('extract');await page.locator('#regex-run').click();await expect(page.locator('#regex-match-rows tr')).toHaveCount(1);
 await page.locator('#regex-group').selectOption('1');await page.locator('#regex-example').click();await expect(page.locator('#regex-output .cm-content')).toHaveText('ORDER-1024ORDER-2048');await expect(page.locator('#regex-group')).toHaveValue('0');
});
