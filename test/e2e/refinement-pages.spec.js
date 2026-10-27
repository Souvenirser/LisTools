import{test,expect}from'@playwright/test';import{readFile}from'node:fs/promises';import QRCode from'qrcode';import Papa from'papaparse';import{chooseTask}from'./task-helpers.js';
test.beforeEach(async({page})=>page.addInitScript(()=>localStorage.setItem('listools-language','en')));
async function bytes(page,button){const pending=page.waitForEvent('download');await button.click();return readFile(await(await pending).path());}

test('large grouping limits its preview while CSV preserves every group',async({page})=>{
 await page.goto('/draw.html');await page.locator('#draw-input').fill(Array.from({length:105},(_,i)=>'Person '+i).join('\n'));await page.locator('#draw-mode').selectOption('groups');await page.locator('#draw-count').fill('105');await page.locator('#draw-run').click();await expect(page.locator('.draw-group')).toHaveCount(100);await expect(page.locator('#draw-preview-notice')).toContainText('100 / 105');const parsed=Papa.parse((await bytes(page,page.locator('#draw-csv'))).toString('utf8')).data;expect(parsed).toHaveLength(105);expect(new Set(parsed.map(row=>row[1])).size).toBe(105);
});
test('QR image import area is keyboard operable and decodes the original Chinese content',async({page})=>{
 await page.goto('/qr.html');await chooseTask(page,'qr','recognize');await page.locator('#qr-drop').focus();const pending=page.waitForEvent('filechooser',{timeout:1500});await page.keyboard.press('Enter');const chooser=await pending;await chooser.setFiles({name:'chinese.png',mimeType:'image/png',buffer:await QRCode.toBuffer('二维码')});await expect(page.locator('#qr-result')).toHaveValue('二维码');
});
test('removing or clearing a dirty crop requires confirmation and dismissal preserves it',async({page})=>{
 await page.goto('/images.html');await page.locator('#images-files').setInputFiles('public/icons/icon-128.png');await chooseTask(page,'images','crop');await page.waitForFunction(()=>document.querySelector('cropper-selection')?.width>0);await page.locator('#images-rotate').click();page.on('dialog',dialog=>dialog.dismiss());const before=await page.locator('cropper-image').evaluate(n=>n.$getTransform());await page.locator('#images-queue').getByRole('button',{name:/Remove/}).click();await expect(page.locator('#images-queue .media-file-name')).toHaveCount(1);expect(await page.locator('cropper-image').evaluate(n=>n.$getTransform())).toEqual(before);await page.locator('#images-clear').click();await expect(page.locator('#images-queue .media-file-name')).toHaveCount(1);
});
test('completed images appear in the main preview without a second jump',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/images.html');await page.locator('#images-files').setInputFiles('public/icons/icon-128.png');await page.locator('#images-run').click();await expect(page.locator('.images-preview-pair')).toBeInViewport();await expect(page.locator('#images-download')).toBeVisible();
});
test('Cron keeps secondary UTC information collapsed and ISO copying accessible',async({page})=>{
 await page.goto('/cron.html');const row=page.locator('#cron-dates tbody tr').first();await expect(row).toBeVisible();await expect(row.locator('.cron-time-context')).toBeHidden();await row.locator('summary').click();await expect(row.locator('.cron-time-context')).toBeVisible();await expect(row.getByRole('button',{name:/Copy ISO/})).toBeVisible();
});
test('timestamp conversion is near the top and copy targets include their context',async({page})=>{
 await page.setViewportSize({width:1366,height:768});await page.goto('/timestamp.html');await expect(page.locator('#timestamp-source')).toBeInViewport({ratio:1});await expect(page.locator('[data-copy="clock-seconds"]')).toHaveAccessibleName(/Copy seconds timestamp.*Current time/);
});
