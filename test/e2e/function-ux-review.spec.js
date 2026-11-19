import {activeTool} from './task-helpers.js';
import{readFileSync}from'node:fs';
import{test,expect}from'@playwright/test';import{selectLanguage}from'./language-helpers.js';
test('re-execute notice survives consecutive edits in ordinary numeric forms',async({page})=>{
 await page.goto('/money.html');await activeTool(page).locator('#money-input').fill('1');await activeTool(page).locator('#money-run').click();await activeTool(page).locator('#money-input').fill('3');await activeTool(page).locator('#money-input').fill('4');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
 await page.goto('/units.html');await activeTool(page).locator('#unit-value').fill('3');await activeTool(page).locator('#unit-value').fill('4');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
 await page.goto('/calculator.html');await activeTool(page).locator('#expression').fill('1+1');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#result')).toHaveText('2');await activeTool(page).locator('#expression').fill('3');await activeTool(page).locator('#expression').fill('4');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');
});
test('random number form submits on Enter while list input retains newlines',async({page})=>{
 await page.goto('/draw.html#numbers');await activeTool(page).locator('#draw-min').fill('5');await activeTool(page).locator('#draw-max').fill('5');await activeTool(page).locator('#draw-number-count').press('Enter');await expect(activeTool(page).locator('#draw-result')).toHaveText('5');await page.goto('/draw.html');await activeTool(page).locator('#draw-input').fill('A');await activeTool(page).locator('#draw-input').press('Enter');await expect(activeTool(page).locator('#draw-input')).toHaveValue('A\n');await expect(activeTool(page).locator('#draw-result')).toBeEmpty();
});
test('compression labels retain the percentage and KiB zero semantics',async({page})=>{
 await page.goto('/images.html');await activeTool(page).locator('#images-files').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:readFileSync('public/icons/icon-128.png')});await expect(activeTool(page).locator('label').filter({has:activeTool(page).locator('#images-target')})).toContainText('KiB');await expect(activeTool(page).locator('#images-compression-mode')).toHaveValue('quality');await expect(activeTool(page).locator('#images-target')).toBeHidden();await activeTool(page).locator('#images-compression-mode').selectOption('target');await expect(activeTool(page).locator('#images-target')).toBeVisible();await expect(activeTool(page).locator('label').filter({has:activeTool(page).locator('#images-quality')})).toContainText('%');
});
test('first successful comparison names its input disclosure Modify input',async({page})=>{
 await page.goto('/diff.html');await activeTool(page).locator('#left-source .cm-content').fill('{"x":1}');await activeTool(page).locator('#right-source .cm-content').fill('{"x":2}');await activeTool(page).locator('#compare').click();await expect(activeTool(page).locator('.diff-result')).toBeVisible();await expect(activeTool(page).locator('#inputs>summary')).toContainText('Modify input');
});
test('localized unit names remain searchable without losing original symbols and English aliases',async({page})=>{
 await page.goto('/units.html');await selectLanguage(page,'de');await activeTool(page).locator('#unit-category').selectOption('area');const choices=activeTool(page).locator('.unit-direction .choices').first();await choices.click();await choices.locator('input[type=search]').fill('Quadratmeter');await expect(choices.locator('[data-choice][data-value=m2]')).toBeVisible();await choices.locator('[data-choice][data-value=m2]').click();await expect(activeTool(page).locator('#unit-from')).toHaveValue('m2');
});
