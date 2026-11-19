import {test,expect} from '@playwright/test';
import {activeTool} from './task-helpers.js';

test('calculator opens history inside its existing information rail',async({page})=>{
 await page.goto('/calculator.html');await expect(activeTool(page).locator('#calculator-history-toggle')).toBeEnabled();await expect(activeTool(page).locator('#history').locator('xpath=ancestor::section')).toBeHidden();
 expect((await activeTool(page).locator('.calculator-workbench').boundingBox()).width).toBeLessThanOrEqual(480);
 const before=await activeTool(page).locator('.calculator-layout').boundingBox();
 await activeTool(page).locator('#expression').fill('2+3');await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#calculator-history-toggle')).toBeEnabled();await activeTool(page).locator('#calculator-history-toggle').click();await expect(activeTool(page).locator('#history')).toContainText('5');await expect(activeTool(page).locator('#result')).toHaveText('5');expect((await activeTool(page).locator('.calculator-layout').boundingBox()).width).toBe(before.width);await expect(activeTool(page).locator('.calculator-info #history')).toBeVisible();
});

test('QR generation action directly follows its input before advanced settings',async({page})=>{
 await page.goto('/qr.html');const input=await activeTool(page).locator('#qr-input').boundingBox(),run=await activeTool(page).locator('#qr-generate').boundingBox();expect(run.y-input.y-input.height).toBeLessThan(90);
 await activeTool(page).locator('#qr-input').fill('中文二维码');await activeTool(page).locator('#qr-generate').click();await expect(activeTool(page).locator('#qr-png')).toBeEnabled();
});

test('draw mode precedes the list and its action stays beside the input',async({page})=>{
 await page.goto('/draw.html');expect((await activeTool(page).locator('#draw-mode').boundingBox()).y).toBeLessThan((await activeTool(page).locator('#draw-input').boundingBox()).y);
 const input=await activeTool(page).locator('#draw-input').boundingBox(),run=await activeTool(page).locator('#draw-run').boundingBox();expect(run.y-input.y-input.height).toBeLessThan(100);
 await activeTool(page).locator('#draw-input').fill('A\nB\nC');await activeTool(page).locator('#draw-run').click();await expect(activeTool(page).locator('#draw-copy')).toBeEnabled();
});

test('timer settings keep the user-controlled disclosure while running and paused',async({page})=>{
 await page.goto('/timer.html');await expect(activeTool(page).locator('#timer-settings')).toHaveAttribute('open','');await activeTool(page).locator('#timer-start').click();await expect(activeTool(page).locator('#timer-settings')).toHaveAttribute('open','');await activeTool(page).locator('#timer-pause').click();await expect(activeTool(page).locator('#timer-settings')).toHaveAttribute('open','');await expect(activeTool(page).locator('#timer-minutes')).toBeEnabled();
});
