import {test,expect} from '@playwright/test';

test('calculator reserves history space only when the user opens nonempty history',async({page})=>{
 await page.goto('/calculator.html');await expect(page.locator('#calculator-history-toggle')).toBeDisabled();await expect(page.locator('#history').locator('xpath=ancestor::section')).toBeHidden();
 expect((await page.locator('.calculator-layout').boundingBox()).width).toBeLessThanOrEqual(480);
 await page.locator('#expression').fill('2+3');await page.locator('#expression').press('Enter');await expect(page.locator('#calculator-history-toggle')).toBeEnabled();await page.locator('#calculator-history-toggle').click();await expect(page.locator('#history')).toContainText('5');await expect(page.locator('#result')).toHaveText('5');
});

test('QR generation action directly follows its input before advanced settings',async({page})=>{
 await page.goto('/qr.html');const input=await page.locator('#qr-input').boundingBox(),run=await page.locator('#qr-generate').boundingBox();expect(run.y-input.y-input.height).toBeLessThan(90);
 await page.locator('#qr-input').fill('中文二维码');await page.locator('#qr-generate').click();await expect(page.locator('#qr-png')).toBeEnabled();
});

test('draw mode precedes the list and its action stays beside the input',async({page})=>{
 await page.goto('/draw.html');expect((await page.locator('#draw-mode').boundingBox()).y).toBeLessThan((await page.locator('#draw-input').boundingBox()).y);
 const input=await page.locator('#draw-input').boundingBox(),run=await page.locator('#draw-run').boundingBox();expect(run.y-input.y-input.height).toBeLessThan(100);
 await page.locator('#draw-input').fill('A\nB\nC');await page.locator('#draw-run').click();await expect(page.locator('#draw-copy')).toBeEnabled();
});

test('timer settings collapse while running and return for a paused adjustment',async({page})=>{
 await page.goto('/timer.html');await expect(page.locator('#timer-settings')).toHaveAttribute('open','');await page.locator('#timer-start').click();await expect(page.locator('#timer-settings')).not.toHaveAttribute('open');await page.locator('#timer-pause').click();await expect(page.locator('#timer-settings')).toHaveAttribute('open','');await expect(page.locator('#timer-minutes')).toBeEnabled();
});
